# Troubleshooting Guide

## Issue 1: Email Confirmation Redirect

**Problem:** After email confirmation, users are redirected to the wrong URL (preview deployment instead of production).

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set **Site URL** to: `https://spendai.vercel.app`
3. Add **Redirect URLs**:
   - `https://spendai.vercel.app/**`
   - `http://localhost:5173/**` (for local development)

**For Development (Disable Email Confirmation):**
1. Go to Supabase Dashboard → Authentication → Providers → Email
2. Disable "Confirm email"
3. This allows instant signup without email verification

## Issue 2: 401 Error on Edge Function

**Problem:** Edge Function returns 401 Unauthorized error.

**Root Cause:** The session token is not being properly passed to the Edge Function.

**Solution:**

The issue is that `supabase.functions.invoke()` needs to explicitly pass the authorization header. Update the KYCForm to ensure the session is fresh:

```typescript
// Get a fresh session before calling the function
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  throw new Error('You must be logged in');
}

// Call the function with explicit headers
const { data, error } = await supabase.functions.invoke('verify-identity', {
  body: { bvn, dob },
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

## Issue 3: PAYSTACK_SECRET_KEY Not Configured

**Problem:** Edge Function can't call Paystack API.

**Solution:**
1. Go to Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Manage secrets**
3. Add secret:
   - Name: `PAYSTACK_SECRET_KEY`
   - Value: `sk_test_d0d53b3fbc46a0c904c8df19286801ae3d60e5fc`
4. Restart the Edge Function (it will pick up the new secret)

## Quick Fix Checklist

- [ ] Set Site URL in Supabase Auth settings
- [ ] Add redirect URLs for production and localhost
- [ ] Disable email confirmation for development (optional)
- [ ] Add PAYSTACK_SECRET_KEY to Edge Function secrets
- [ ] Update KYCForm to pass authorization header explicitly
- [ ] Test signup flow end-to-end

## Testing After Fixes

1. Clear browser cache and cookies
2. Sign up with a new email
3. If email confirmation is disabled, you should go straight to KYC
4. Enter test BVN: `22123456789`
5. Should successfully verify and redirect to dashboard
