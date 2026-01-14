export type AppPhase = 'AUTH' | 'KYC' | 'DASHBOARD' | 'LINK_VIEW';

// --- Frontend Types ---

export interface User {
  id: string;
  name: string;
  email: string;
  kycVerified: boolean;
  bvn?: string;
  walletBalance: number;
  virtualAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  category: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface SecureLink {
  amount: number;
  code: string;
  id: string;
  createdAt: Date;
}

// --- Database Schema Types (For Phase 1 & 2) ---

export interface DbProfile {
  id: string; // matches auth.users.id
  email: string;
  full_name: string;
  avatar_url?: string;
  kyc_verified: boolean;
  kyc_tier: 1 | 2 | 3;
  created_at: string;
}

export interface DbWallet {
  id: string; // uuid
  user_id: string; // foreign key to profiles.id
  balance: number; // store in kobo/cents (integer) to avoid float errors
  currency: 'NGN';
  nuban_account_number?: string;
  nuban_bank_name?: string;
  nuban_account_name?: string;
  paystack_customer_code?: string;
  updated_at: string;
}

export interface DbTransaction {
  id: string; // uuid
  wallet_id: string; // foreign key to wallets.id
  amount: number; // positive for credit, negative for debit
  type: 'credit' | 'debit';
  description: string;
  category: string;
  reference: string; // payment gateway reference
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

export interface DbSecureLink {
  id: string; // uuid
  creator_wallet_id: string;
  amount: number;
  passcode_hash: string; // Never store plain text passcode
  status: 'active' | 'claimed' | 'expired';
  claimed_by_wallet_id?: string;
  created_at: string;
  expires_at: string;
}