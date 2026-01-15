# Phase 4: Secure AI & Secure Links Setup

## Overview

Phase 4 implements two major features:
1. **Secure AI Financial Advisor** - Gemini API calls moved to Edge Function (API key no longer exposed in frontend)
2. **Secure Links** - Create passcode-protected payment links to send money

## What Was Implemented

### 1. Secure Links Database Schema

Created `secure_links` table with:
- Unique 8-character link codes
- Passcode protection (hashed)
- Amount tracking
- Status management (active, claimed, expired, cancelled)
- Expiration (7 days default)
- RLS policies for security

### 2. Database Functions

**`create_payment_link(amount, description)`**
- Validates user has sufficient balance
- Deducts amount from wallet
- Generates unique link code
- Creates transaction record
- Returns link details

**`claim_payment_link(link_code, passcode)`**
- Validates link exists and is active
- Verifies passcode
- Prevents self-claiming
- Credits claimer's wallet
- Updates link status
- Creates transaction record

### 3. Edge Functions

**`ask-financial-advisor`**
- Securely calls Gemini API with server-side API key
- Fetches user's wallet balance and recent transactions
- Constructs context-aware prompts
- Returns AI-generated financial advice

### 4. Services

**`secureLinksService.ts`**
- `createLink(amount, description)` - Create new payment link
- `claimLink(linkCode, passcode)` - Claim a payment link
- `getUserLinks()` - Get user's created links
- `cancelLink(linkId)` - Cancel an active link

**`geminiService.ts`** (Updated)
- `askFinancialAdvisor(prompt)` - Get AI financial advice via Edge Function
- API key now secure on server-side

## Configuration Steps

### Step 1: Set Gemini API Key in Supabase

You need to add the Gemini API key to your Supabase Edge Functions:

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Manage secrets**
3. Add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: `YOUR_GEMINI_API_KEY_HERE`
4. Click **Save**

### Step 2: Verify Migration Applied

The `secure_links` table should already be created. Verify by:
1. Go to Supabase Dashboard → Table Editor
2. Check if `secure_links` table exists
3. Check if functions `create_payment_link` and `claim_payment_link` exist in Database → Functions

### Step 3: Test the Features

#### Test AI Financial Advisor

```typescript
import { geminiService } from './services/geminiService';

// Ask for advice
const advice = await geminiService.askFinancialAdvisor('How can I save money?');
console.log(advice);
```

#### Test Secure Links

```typescript
import { secureLinksService } from './services/secureLinksService';
import { nairaToKobo } from './lib/currency';

// Create a link for ₦1,000
const link = await secureLinksService.createLink(
  nairaToKobo(1000),
  'Lunch money'
);
console.log('Link Code:', link.link_code);

// Claim a link (from another user's account)
const result = await secureLinksService.claimLink('ABC12345', '1234');
console.log('Claimed:', result.amount / 100, 'Naira');
```

## Security Features

### Secure Links
1. **Passcode Protection** - Links require 4-digit passcode to claim
2. **Expiration** - Links expire after 7 days
3. **One-time Use** - Links can only be claimed once
4. **Self-claim Prevention** - Users cannot claim their own links
5. **RLS Policies** - Users can only see their own created links

### AI Financial Advisor
1. **Server-side API Key** - Gemini API key never exposed to frontend
2. **User Context** - Only fetches authenticated user's data
3. **Rate Limiting** - Can be added via Supabase Edge Function settings
4. **Input Validation** - Validates prompt before processing

## API Reference

### Secure Links Service

```typescript
// Create a payment link
const link = await secureLinksService.createLink(
  amount: number,        // Amount in kobo (e.g., 100000 = ₦1,000)
  description?: string   // Optional description
);

// Claim a payment link
const result = await secureLinksService.claimLink(
  linkCode: string,      // 8-character code (e.g., 'ABC12345')
  passcode: string       // 4-digit passcode
);

// Get user's links
const links = await secureLinksService.getUserLinks();

// Cancel a link
await secureLinksService.cancelLink(linkId: string);
```

### Gemini Service

```typescript
// Ask financial advisor
const advice = await geminiService.askFinancialAdvisor(
  prompt: string         // User's question
);
```

## Database Schema

### secure_links Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| creator_wallet_id | UUID | Wallet that created the link |
| amount | BIGINT | Amount in kobo |
| passcode_hash | TEXT | Hashed passcode |
| link_code | TEXT | Unique 8-character code |
| description | TEXT | Optional description |
| status | TEXT | active, claimed, expired, cancelled |
| claimed_by_wallet_id | UUID | Wallet that claimed (if claimed) |
| claimed_at | TIMESTAMPTZ | When claimed |
| created_at | TIMESTAMPTZ | When created |
| expires_at | TIMESTAMPTZ | When expires (7 days default) |
| updated_at | TIMESTAMPTZ | Last updated |

## Next Steps

### Frontend Integration

You'll need to update your UI components to use these new services:

1. **Dashboard** - Add "Create Secure Link" button
2. **Link Creation Modal** - Form to create links with amount and description
3. **Link Display** - Show created links with codes and status
4. **Link Claim Modal** - Form to claim links with code and passcode
5. **AI Chat Interface** - Chat UI to interact with financial advisor

### Example UI Flow

**Creating a Link:**
1. User clicks "Send Money" → "Create Secure Link"
2. Enters amount (e.g., ₦5,000) and description
3. System generates link code (e.g., "XYZ789AB")
4. User shares code with recipient
5. Recipient enters code + passcode to claim

**Using AI Advisor:**
1. User clicks "Financial Advisor" button
2. Types question: "Can I afford to buy a ₦50,000 phone?"
3. AI analyzes balance and spending patterns
4. Returns personalized advice

## Testing Checklist

- [ ] Gemini API key configured in Supabase
- [ ] `secure_links` table exists in database
- [ ] Database functions created successfully
- [ ] Edge Function `ask-financial-advisor` deployed
- [ ] Can create payment links
- [ ] Can claim payment links
- [ ] Cannot claim own links
- [ ] Links expire after 7 days
- [ ] AI advisor returns relevant advice
- [ ] Balance and transactions included in AI context

## Troubleshooting

### Issue: "GEMINI_API_KEY not configured"
**Solution:** Add the API key to Supabase Edge Function secrets (see Step 1)

### Issue: "Insufficient balance" when creating link
**Solution:** Ensure user has enough balance in their wallet. Amount is in kobo (multiply Naira by 100)

### Issue: "Link not found, already claimed, or expired"
**Solution:** 
- Check link code is correct (case-insensitive)
- Verify link hasn't been claimed already
- Check link hasn't expired (7 days)

### Issue: "Cannot claim your own link"
**Solution:** Links can only be claimed by other users, not the creator

## Production Considerations

1. **Passcode Security** - Current implementation uses simple MD5 hashing. For production, use bcrypt or argon2
2. **Rate Limiting** - Add rate limits to prevent abuse of link creation
3. **Link Expiration** - Consider adding automatic cleanup of expired links
4. **Notifications** - Send notifications when links are claimed
5. **Analytics** - Track link usage and claim rates

