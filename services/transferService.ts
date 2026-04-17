import { supabase } from '../lib/supabase';

export interface TransferParams {
  account_number: string;
  bank_name: string;
  amount: number;
  account_name?: string;
  reason?: string;
}

export interface TransferResult {
  success: boolean;
  data?: {
    status: string;
    reference: string;
    amount: number;
    recipient: {
      account_number: string;
      bank_name: string;
      account_name: string;
    };
  };
  new_balance?: number;
  error?: string;
}

export const transferService = {
  /**
   * Initiate a bank transfer
   */
  async initiateTransfer(params: TransferParams): Promise<TransferResult> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: 'You must be logged in to make transfers' };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/initiate-transfer`;

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params)
      });

      const result = await response.json();

      if (!response.ok) {
        return { 
          success: false, 
          error: result.error || result.details || `Transfer failed (${response.status})` 
        };
      }

      return {
        success: true,
        data: result.data,
        new_balance: result.new_balance
      };
    } catch (error: any) {
      console.error('Transfer service error:', error);
      return { success: false, error: error.message || 'Network error during transfer' };
    }
  },

  /**
   * Quick parse for common transfer phrases
   * This is a client-side helper for immediate feedback before AI processing
   */
  parseTransferIntent(text: string): Partial<TransferParams> | null {
    // Look for amount patterns
    const amountMatch = text.match(/(\d+\.?\d*)\s*[kK]/) || 
                        text.match(/(?:send|pay|transfer)\s*(?:#|₦|N)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    
    let amount: number | undefined;
    if (amountMatch) {
      const rawAmount = amountMatch[1].replace(/,/g, '');
      if (text.match(/\d+\.?\d*\s*[kK]/)) {
        // Handle "5k", "2.5k" format
        amount = parseFloat(rawAmount) * 1000;
      } else {
        amount = parseFloat(rawAmount);
      }
    }

    // Look for 10-digit account numbers
    const accountMatch = text.match(/\b(\d{9,10})\b/);
    const account_number = accountMatch ? accountMatch[1] : undefined;

    // Look for bank names
    const bankKeywords = [
      'access', 'gtbank', 'gt bank', 'zenith', 'first bank', 'uba', 
      'union bank', 'fidelity', 'ecobank', 'sterling', 'wema', 'alat',
      'polaris', 'keystone', 'unity', 'jaiz', 'opay', 'palmpay', 
      'moniepoint', 'kuda'
    ];
    
    let bank_name: string | undefined;
    const lowerText = text.toLowerCase();
    for (const bank of bankKeywords) {
      if (lowerText.includes(bank)) {
        bank_name = bank;
        break;
      }
    }

    // Extract account name (anything after account number that's not a number)
    let account_name: string | undefined;
    if (account_number) {
      const afterAccount = text.split(account_number)[1];
      if (afterAccount) {
        // Look for name patterns (2-4 words that aren't numbers)
        const nameMatch = afterAccount.match(/\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){1,3})/);
        if (nameMatch) {
          account_name = nameMatch[1].trim();
        }
      }
    }

    // Only return if we found at least account and bank
    if (account_number && bank_name) {
      return {
        account_number,
        bank_name,
        amount,
        account_name
      };
    }

    return null;
  }
};
