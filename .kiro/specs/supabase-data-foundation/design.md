# Design Document

## Overview

This design establishes the data foundation for Spend.AI by implementing a PostgreSQL database on Supabase with proper authentication, data models, and security policies. The system replaces React state management with persistent storage, enabling multi-session data persistence and secure multi-user access.

The architecture follows Supabase best practices:
- Supabase Auth for user management
- PostgreSQL with Row Level Security (RLS) for data protection
- TypeScript types generated from schema for type safety
- Client-side SDK for seamless frontend integration

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   AuthForm   │  │  Dashboard   │  │   KYCForm    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │ Supabase Client │                        │
│                   │   (@supabase/   │                        │
│                   │  supabase-js)   │                        │
│                   └────────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTPS + JWT
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                      Supabase Backend                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Supabase Auth (auth.users)              │    │
│  └────────────────────────┬─────────────────────────────┘    │
│                            │                                  │
│  ┌────────────────────────▼─────────────────────────────┐    │
│  │            PostgreSQL Database + RLS                 │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ profiles │  │ wallets  │  │  transactions    │  │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────────────┘  │    │
│  │       │             │              │                 │    │
│  │       │ FK: user_id │ FK: user_id  │ FK: wallet_id  │    │
│  │       └─────────────┴──────────────┘                 │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Authentication Flow:**
   - User submits credentials → Supabase Auth validates → Returns JWT token
   - Frontend stores token → Includes in all subsequent requests
   - Backend validates JWT → Extracts user ID → Enforces RLS policies

2. **Data Access Flow:**
   - Frontend queries via Supabase client → Client adds JWT to request
   - PostgreSQL RLS checks auth.uid() → Filters results to user's data only
   - Returns filtered data → Frontend updates UI

3. **Transaction Creation Flow:**
   - User action triggers transaction → Frontend calls Supabase client
   - RLS verifies wallet ownership → Inserts transaction record
   - Updates wallet balance → Returns success/failure

## Components and Interfaces

### Supabase Client Configuration

The frontend will use `@supabase/supabase-js` to interact with Supabase:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### Authentication Service

```typescript
interface AuthService {
  // Sign up new user
  signUp(email: string, password: string, fullName: string): Promise<AuthResult>
  
  // Sign in existing user
  signIn(email: string, password: string): Promise<AuthResult>
  
  // Sign out current user
  signOut(): Promise<void>
  
  // Get current session
  getSession(): Promise<Session | null>
  
  // Listen to auth state changes
  onAuthStateChange(callback: (session: Session | null) => void): Subscription
}

interface AuthResult {
  user: User | null
  session: Session | null
  error: Error | null
}
```

### Database Service

```typescript
interface DatabaseService {
  // Profile operations
  getProfile(userId: string): Promise<DbProfile | null>
  updateProfile(userId: string, updates: Partial<DbProfile>): Promise<DbProfile>
  
  // Wallet operations
  getWallet(userId: string): Promise<DbWallet | null>
  updateWalletBalance(walletId: string, amount: number): Promise<DbWallet>
  
  // Transaction operations
  getTransactions(walletId: string, limit?: number): Promise<DbTransaction[]>
  createTransaction(transaction: NewTransaction): Promise<DbTransaction>
  
  // Combined operations
  getUserData(userId: string): Promise<UserData>
}

interface UserData {
  profile: DbProfile
  wallet: DbWallet
  recentTransactions: DbTransaction[]
}

interface NewTransaction {
  wallet_id: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  category: string
  reference: string
  status: 'pending' | 'success' | 'failed'
}
```

## Data Models

### Database Schema

#### profiles table

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  kyc_verified BOOLEAN DEFAULT FALSE,
  kyc_tier INTEGER DEFAULT 1 CHECK (kyc_tier IN (1, 2, 3)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- `id` → `auth.users.id` (one-to-one, CASCADE delete)

**Indexes:**
- Primary key on `id`
- Index on `email` for lookups

#### wallets table

```sql
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance BIGINT DEFAULT 0 CHECK (balance >= 0),
  currency TEXT DEFAULT 'NGN' CHECK (currency = 'NGN'),
  nuban_account_number TEXT,
  nuban_bank_name TEXT,
  nuban_account_name TEXT,
  paystack_customer_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**Relationships:**
- `user_id` → `profiles.id` (one-to-one, CASCADE delete)

**Indexes:**
- Primary key on `id`
- Unique index on `user_id`
- Index on `paystack_customer_code` for webhook lookups

**Notes:**
- Balance stored in kobo (multiply by 100 when storing, divide by 100 when displaying)
- NUBAN fields populated after KYC verification (Phase 2)

#### transactions table

```sql
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- `wallet_id` → `wallets.id` (many-to-one, CASCADE delete)

**Indexes:**
- Primary key on `id`
- Index on `wallet_id` for user transaction queries
- Unique index on `reference` for idempotency
- Index on `created_at` for chronological queries

**Notes:**
- Amount stored in kobo (always positive, type determines direction)
- Reference must be unique to prevent duplicate transactions

### TypeScript Types

Generated types will match the database schema:

```typescript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: DbProfile
        Insert: Omit<DbProfile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DbProfile, 'id' | 'created_at'>>
      }
      wallets: {
        Row: DbWallet
        Insert: Omit<DbWallet, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DbWallet, 'id' | 'created_at'>>
      }
      transactions: {
        Row: DbTransaction
        Insert: Omit<DbTransaction, 'id' | 'created_at'>
        Update: Partial<Omit<DbTransaction, 'id' | 'created_at'>>
      }
    }
  }
}
```

### Row Level Security Policies

#### profiles table policies

```sql
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- System can insert profiles (via trigger on auth.users)
CREATE POLICY "Enable insert for authenticated users only"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

#### wallets table policies

```sql
-- Users can read their own wallet
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own wallet (for balance changes)
CREATE POLICY "Users can update own wallet"
  ON public.wallets FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert wallets (via trigger on profiles)
CREATE POLICY "Enable insert for authenticated users only"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### transactions table policies

```sql
-- Users can read transactions from their wallet
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets
      WHERE wallets.id = transactions.wallet_id
      AND wallets.user_id = auth.uid()
    )
  );

-- Users can insert transactions to their wallet
CREATE POLICY "Users can create own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wallets
      WHERE wallets.id = transactions.wallet_id
      AND wallets.user_id = auth.uid()
    )
  );
```

### Database Triggers

#### Auto-create profile on user signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Auto-create wallet on profile creation

```sql
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance, currency)
  VALUES (NEW.id, 0, 'NGN');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();
```

#### Update timestamp on wallet changes

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Account creation succeeds for valid credentials

*For any* valid email and password combination, calling the signup function should successfully create an authenticated account with a valid user ID and session.

**Validates: Requirements 1.1**

### Property 2: Authentication succeeds for existing credentials

*For any* user account that has been created, attempting to sign in with the correct credentials should return a valid session with matching user ID.

**Validates: Requirements 1.2**

### Property 3: Authentication errors are descriptive

*For any* invalid authentication attempt (wrong password, non-existent email, malformed input), the system should return an error message that describes the failure reason.

**Validates: Requirements 1.3**

### Property 4: Session invalidation on logout

*For any* active user session, calling logout should invalidate the session such that subsequent authenticated requests fail until re-authentication.

**Validates: Requirements 1.5**

### Property 5: Profile auto-creation on signup

*For any* user account created through signup, a corresponding profile record should automatically exist in the profiles table with matching user ID.

**Validates: Requirements 2.1**

### Property 6: Profile updates persist

*For any* profile field update (full_name, avatar_url, kyc_verified, kyc_tier), reading the profile immediately after the update should return the new value.

**Validates: Requirements 2.3**

### Property 7: Enum field validation

*For any* field with enumerated values (kyc_tier: 1,2,3; transaction status: pending,success,failed; transaction type: credit,debit), the system should accept valid values and reject invalid values with an error.

**Validates: Requirements 2.5, 4.4**

### Property 8: Wallet auto-creation on profile creation

*For any* profile created in the system, a corresponding wallet record should automatically exist with user_id matching the profile ID and initial balance of 0.

**Validates: Requirements 3.1**

### Property 9: Wallet timestamp updates on balance change

*For any* wallet balance modification, the updated_at timestamp should be greater than its previous value.

**Validates: Requirements 3.6**

### Property 10: Transaction creation for balance changes

*For any* wallet balance change (credit or debit), a corresponding transaction record should exist with matching wallet_id, amount, and type.

**Validates: Requirements 4.1**

### Property 11: Transaction reference uniqueness

*For any* two transaction creation attempts with the same reference string, the second attempt should fail with a uniqueness constraint error.

**Validates: Requirements 4.3**

### Property 12: User data isolation via RLS

*For any* two distinct authenticated users (User A and User B), when User A queries profiles, wallets, or transactions, the results should contain only User A's data and none of User B's data.

**Validates: Requirements 5.1, 5.2, 5.3, 5.5**

### Property 13: CASCADE delete behavior

*For any* profile deletion, all associated wallet and transaction records should be automatically deleted from the database.

**Validates: Requirements 6.6**

### Property 14: Type-schema consistency

*For any* database schema state, the generated TypeScript types should accurately represent all table structures, field types, and relationships such that type-safe queries match actual database operations.

**Validates: Requirements 8.2, 8.5**

## Error Handling

### Authentication Errors

- **Invalid credentials**: Return clear error message indicating authentication failure
- **Duplicate email**: Return error indicating email already registered
- **Malformed email**: Return validation error before attempting signup
- **Network errors**: Catch and return user-friendly connection error message

### Database Errors

- **Constraint violations**: 
  - Unique constraint (duplicate reference): Return error with conflicting field
  - Check constraint (invalid enum): Return error with valid options
  - Foreign key violation: Return error indicating missing parent record
  
- **RLS policy violations**: Return 403 Forbidden with message about insufficient permissions

- **Connection errors**: Implement retry logic with exponential backoff, surface error after max retries

### Data Validation Errors

- **Balance validation**: Prevent negative balances at application level before database insert
- **Amount validation**: Ensure transaction amounts are positive integers (kobo)
- **Required fields**: Validate all required fields are present before database operations

### Error Response Format

All errors should follow consistent structure:

```typescript
interface ErrorResponse {
  error: {
    message: string
    code: string
    details?: Record<string, any>
  }
}
```

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both types of tests are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across many inputs.

### Property-Based Testing Configuration

We will use **fast-check** (JavaScript/TypeScript property-based testing library) for property tests:

```bash
npm install --save-dev fast-check @types/fast-check
```

**Configuration:**
- Minimum 100 iterations per property test
- Each property test must reference its design document property
- Tag format: `// Feature: supabase-data-foundation, Property {number}: {property_text}`

**Example property test structure:**

```typescript
import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

describe('Supabase Data Foundation Properties', () => {
  it('Property 1: Account creation succeeds for valid credentials', async () => {
    // Feature: supabase-data-foundation, Property 1: Account creation succeeds for valid credentials
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 8 }),
        async (email, password) => {
          const result = await supabase.auth.signUp({ email, password })
          expect(result.data.user).toBeDefined()
          expect(result.data.session).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Unit Testing Focus

Unit tests should focus on:
- Specific examples that demonstrate correct behavior (e.g., signing up with a known email)
- Edge cases (e.g., empty strings, boundary values)
- Error conditions (e.g., duplicate email, invalid format)
- Integration points between components (e.g., auth → profile → wallet cascade)

### Test Coverage Areas

1. **Authentication Service**
   - Unit: Test signup/signin/signout with specific credentials
   - Property: Test authentication flow with random valid credentials

2. **Database Triggers**
   - Unit: Test profile creation for specific user
   - Property: Test profile/wallet auto-creation for any user signup

3. **RLS Policies**
   - Unit: Test specific user cannot access specific other user's data
   - Property: Test any user cannot access any other user's data

4. **Data Validation**
   - Unit: Test specific invalid enum values are rejected
   - Property: Test all invalid enum values are rejected, all valid accepted

5. **Type Generation**
   - Unit: Test specific table types are generated correctly
   - Property: Test all table types match schema structure

### Testing Environment

- Use Supabase local development environment for tests
- Seed test database with known data for unit tests
- Clean database between property test runs to ensure independence
- Mock external services (Paystack) in Phase 1 tests
