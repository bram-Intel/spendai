# Supabase Setup Guide

This document describes the Supabase database setup for Spend.AI.

## Database Schema

### Tables

#### 1. profiles
Extends the default `auth.users` table with additional user information.

- `id` (UUID, PK) - References auth.users.id
- `email` (TEXT) - User email
- `full_name` (TEXT) - User's full name
- `avatar_url` (TEXT, nullable) - Profile picture URL
- `kyc_verified` (BOOLEAN) - KYC verification status
- `kyc_tier` (INTEGER) - KYC tier (1, 2, or 3)
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

#### 2. wallets
Stores user wallet information and balance.

- `id` (UUID, PK) - Wallet ID
- `user_id` (UUID, FK) - References profiles.id
- `balance` (BIGINT) - Balance in kobo (1 Naira = 100 Kobo)
- `currency` (TEXT) - Currency code (NGN)
- `nuban_account_number` (TEXT, nullable) - Virtual account number
- `nuban_bank_name` (TEXT, nullable) - Virtual account bank name
- `nuban_account_name` (TEXT, nullable) - Virtual account name
- `paystack_customer_code` (TEXT, nullable) - Paystack customer code
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

#### 3. transactions
Ledger of all money movements.

- `id` (UUID, PK) - Transaction ID
- `wallet_id` (UUID, FK) - References wallets.id
- `amount` (BIGINT) - Amount in kobo (always positive)
- `type` (TEXT) - Transaction type ('credit' or 'debit')
- `description` (TEXT) - Transaction description
- `category` (TEXT) - Transaction category
- `reference` (TEXT, UNIQUE) - Payment gateway reference
- `status` (TEXT) - Status ('pending', 'success', or 'failed')
- `created_at` (TIMESTAMPTZ) - Creation timestamp

## Database Triggers

### 1. Auto-create profile on user signup
When a new user signs up via Supabase Auth, a profile is automatically created.

### 2. Auto-create wallet on profile creation
When a profile is created, a wallet is automatically created with 0 balance.

### 3. Update timestamps
The `updated_at` field is automatically updated on profile and wallet changes.

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### profiles
- Users can view their own profile
- Users can update their own profile
- Authenticated users can insert their own profile

### wallets
- Users can view their own wallet
- Users can update their own wallet
- Authenticated users can insert their own wallet

### transactions
- Users can view transactions from their wallet
- Users can create transactions to their wallet

## Environment Variables

Required environment variables in `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Currency Handling

All monetary amounts are stored in **kobo** (the smallest unit of Nigerian currency):
- 1 Naira = 100 Kobo
- Store: `nairaToKobo(amount)` - multiply by 100
- Display: `koboToNaira(amount)` - divide by 100

This prevents floating-point precision errors in financial calculations.

## Services

### authService
Handles user authentication:
- `signUp(email, password, fullName)` - Register new user
- `signIn(email, password)` - Sign in existing user
- `signOut()` - Sign out current user
- `getSession()` - Get current session
- `onAuthStateChange(callback)` - Listen to auth changes

### databaseService
Handles database operations:
- `getProfile(userId)` - Get user profile
- `updateProfile(userId, updates)` - Update profile
- `getWallet(userId)` - Get user wallet
- `updateWalletBalance(walletId, amount)` - Update balance
- `getTransactions(walletId, limit)` - Get transactions
- `createTransaction(transaction)` - Create transaction
- `getUserData(userId)` - Get all user data

## Testing

To test the authentication flow:

1. Start the dev server: `npm run dev`
2. Navigate to the app
3. Click "Sign up" to create a new account
4. Enter email, password, and full name
5. Sign up will create:
   - Auth user in `auth.users`
   - Profile in `public.profiles`
   - Wallet in `public.wallets` (with 0 balance)

## Next Steps

Phase 2 will add:
- KYC verification via Paystack
- Virtual account creation
- Webhook handling for incoming payments
