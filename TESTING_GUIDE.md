# Testing Guide - Phase 2 Complete

## What Was Fixed

The Edge Function now automatically detects test mode and bypasses Paystack's BVN API (which doesn't work with test keys). This allows you to test the complete KYC flow without needing real BVN verification.

## How to Test

### 1. Sign Up Flow
1. Go to https://spendai.vercel.app
2. Click "Sign Up" 
3. Enter email and password
4. If email confirmation is enabled, check your email and click the confirmation link
5. You should be redirected to the KYC form

### 2. KYC Verification (Test Mode)
1. Enter any 11-digit BVN (e.g., `12345678901`)
2. Enter any date of birth
3. Click "Verify Identity"
4. The Edge Function will:
   - Detect test mode (because you're using `sk_test_` key)
   - Skip Paystack API call
   - Return mock user data
   - Update your profile to `kyc_verified = true`
5. You should be redirected to the Dashboard

### 3. Sign In Flow (Existing Users)
1. Go to https://spendai.vercel.app
2. If you're already signed up, click "Sign In"
3. Enter your email and password
4. If KYC is complete, you'll go straight to Dashboard
5. If KYC is not complete, you'll go to KYC form

## What Happens in Test Mode vs Production

### Test Mode (Current - using `sk_test_` key)
- Any 11-digit BVN is accepted
- No actual Paystack API call is made
- Mock data is returned: `{ first_name: "Test", last_name: "User", phone: "08012345678" }`
- Perfect for development and testing

### Production Mode (Future - using `sk_live_` key)
- Real BVN numbers are required
- Actual Paystack API is called
- Real user data is returned from BVN database
- Only valid BVNs will pass verification

## Troubleshooting

### Issue: Still getting 401 error
**Solution:** Make sure you've added `PAYSTACK_SECRET_KEY` to Supabase Edge Function secrets:
1. Go to Supabase Dashboard
2. Project Settings → Edge Functions → Manage secrets
3. Add: `PAYSTACK_SECRET_KEY` = `sk_test_d0d53b3fbc46a0c904c8df19286801ae3d60e5fc`

### Issue: Redirected to wrong URL after email confirmation
**Solution:** Update Supabase Site URL:
1. Go to Supabase Dashboard
2. Authentication → URL Configuration
3. Set Site URL to: `https://spendai.vercel.app`

### Issue: "No valid session found" error
**Solution:** This usually means:
- You're not logged in (sign up or sign in first)
- Your session expired (sign in again)
- Browser cache issue (clear cache and try again)

## Next Steps

After confirming Phase 2 works:
- **Phase 3:** Create virtual accounts via Paystack
- **Phase 4:** Set up webhook handling for incoming payments
- **Phase 5:** Implement Secure Links and AI advisor

## Files Changed

1. `supabase/functions/verify-identity/index.ts` - Added test mode bypass
2. `TROUBLESHOOTING.md` - Added test mode documentation
3. `PHASE2_SETUP.md` - Updated with test mode information

All changes have been committed and pushed to GitHub.
