# Spend.AI - Architecture & Execution Roadmap

This document outlines the path from "Prototype" to "Production Fintech App" using Next.js (or Vite/React), Supabase, and Paystack.

## Phase 1: The Data Foundation (Supabase)
**Goal:** Replace React State with a persistent PostgreSQL Database.

1.  **Initialize Supabase Project**
    *   Create a new project in Supabase dashboard.
    *   Enable Email/Password Authentication.
2.  **Database Modeling**
    *   Create table `profiles`: Extends the default `auth.users` table.
    *   Create table `wallets`: Stores the balance and NUBAN details.
    *   Create table `transactions`: Ledger of all money movement.
3.  **Row Level Security (RLS)**
    *   **Critical:** Ensure users can only `SELECT` their own wallet and transactions.
    *   Policy: `auth.uid() == user_id`.

## Phase 2: Compliance & Identity (Paystack Integration)
**Goal:** Verify user identity (KYC) before issuing accounts.

1.  **Backend Logic (Edge Functions)**
    *   Create Supabase Edge Function: `verify-identity`.
    *   **Flow:** Frontend sends BVN -> Edge Function calls Paystack API (`GET /bank/resolve_bvn/:bvn`) -> If valid, update `profiles.kyc_verified = true`.
2.  **Frontend Update**
    *   Update `KYCForm.tsx` to call this Edge Function instead of `setTimeout`.

## Phase 3: The Banking Core (Virtual Accounts)
**Goal:** Give users a real bank account number to fund their wallet.

1.  **Issue Account**
    *   Create Edge Function: `create-virtual-account`.
    *   **Flow:** Triggered automatically when KYC passes. Calls Paystack API (`POST /dedicated_account`).
    *   **Save:** Store `account_number` and `bank_name` in the `wallets` table.
2.  **Receiving Money (Webhooks)**
    *   Create Edge Function: `paystack-webhook`.
    *   **Logic:** Listen for Paystack event `charge.success`.
    *   **Security:** Verify Paystack Signature (HMAC SHA512).
    *   **Action:** Find user by customer code -> Increment `wallets.balance` -> Insert row into `transactions`.

## Phase 4: Secure AI & Logic
**Goal:** Secure the Gemini API key and implement the "Secure Link" logic.

1.  **Secure Gemini**
    *   **Risk:** Currently `API_KEY` is in the frontend.
    *   **Fix:** Create Edge Function `ask-financial-advisor`.
    *   **Logic:** Frontend sends prompt -> Function fetches User's Balance & Last 5 Tx from DB -> Function constructs System Prompt -> Function calls Gemini -> Returns text.
2.  **Secure Links Logic**
    *   **Create Link:** Transactional DB operation (Deduct Balance -> Create Link Record).
    *   **Claim Link:** Transactional DB operation (Verify Code -> Mark Link Claimed -> Credit Recipient Balance).

## Phase 5: Production Polish
1.  **Environment Variables:** Setup `.env.local` for all API Keys.
2.  **Deployment:** Deploy frontend to Vercel/Netlify.
3.  **PWA:** Add `manifest.json` and service workers for mobile-app-like experience.
