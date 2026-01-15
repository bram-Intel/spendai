# Phase 2: KYC & Identity Verification Setup

## Overview

Phase 2 implements identity verification using Paystack's BVN (Bank Verification Number) API. When users complete KYC, their identity is verified and their profile is updated to allow access to banking features.

## Components

### 1. Supabase Edge Function: `verify-identity`

**Location:** `supabase/functions/verify-identity/index.ts`

**Purpose:** Securely verify user identity via Paystack BVN API

**Flow:**
1. Frontend sends BVN to Edge Function
2. Edge Function authenticates the user
3. Edge Function calls Paystack API to verify BVN
4. If valid, updates `profiles.kyc_verified = true`
5. Returns success/failure to frontend

**Environment Variables Required:**
- `PAYSTACK_SECRET_KEY` - Your Paystack secret key (configured in Supabase dashboard)
- `SUPABASE_URL` - Auto-configured by Supabase
- `SUPABASE_ANON_KEY` - Auto-configured by Supabase

### 2. KYCForm Component

**Location:** `components/KYCForm.tsx`

**Updates:**
- Calls the `verify-identity` Edge Function
- Handles authentication check
- Displays verification status and errors
- Redirects to dashboard on success

## Configuration Steps

### Step 1: Set Paystack Secret Key in Supabase

You need to add the Paystack secret key to your Supabase project:

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Add a new secret:
   - Name: `PAYSTACK_SECRET_KEY`
   - Value: `sk_test_d0d53b3fbc46a0c904c8df19286801ae3d60e5fc`

### Step 2: Test the Integration

1. Start your dev server: `npm run dev`
2. Sign up for a new account
3. You'll be redirected to the KYC form
4. Enter a valid BVN (11 digits)
5. Enter your date of birth
6. Click "Verify Identity"

**Note:** For testing, you can use Paystack's test BVN: `22123456789`

## Paystack BVN API

**Endpoint:** `GET https://api.paystack.co/bank/resolve_bvn/:bvn`

**Headers:**
- `Authorization: Bearer YOUR_SECRET_KEY`
- `Content-Type: application/json`

**Response (Success):**
```json
{
  "status": true,
  "message": "BVN resolved",
  "data": {
    "first_name": "John",
    "last_name": "Doe",
    "phone": "08012345678",
    "bvn": "22123456789"
  }
}
```

**Response (Error):**
```json
{
  "status": false,
  "message": "Invalid BVN"
}
```

## Security Features

1. **JWT Verification:** Edge Function requires valid Supabase JWT
2. **User Authentication:** Verifies user is logged in before processing
3. **CORS Headers:** Properly configured for frontend access
4. **Secret Key Protection:** Paystack secret key never exposed to frontend
5. **Input Validation:** BVN format validation (11 digits)

## Database Updates

When KYC is successful, the following fields are updated in `profiles` table:
- `kyc_verified` → `true`
- `kyc_tier` → `1`
- `updated_at` → current timestamp

## Error Handling

The Edge Function handles these error cases:
- Missing authorization header
- Invalid/expired JWT token
- Invalid BVN format (not 11 digits)
- Paystack API errors
- Database update failures

## Next Steps

After Phase 2 is complete, Phase 3 will:
- Create virtual accounts via Paystack
- Set up webhook handling for incoming payments
- Update wallet balances automatically

## Testing Checklist

- [ ] Edge Function deployed successfully
- [ ] Paystack secret key configured in Supabase
- [ ] User can sign up and reach KYC form
- [ ] BVN verification works with test BVN
- [ ] Profile is updated after successful verification
- [ ] User is redirected to dashboard after KYC
- [ ] Error messages display correctly for invalid BVN
