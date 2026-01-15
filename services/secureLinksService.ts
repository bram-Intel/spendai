import { supabase } from '../lib/supabase';

export interface SecureLink {
  id: string;
  link_code: string;
  amount: number;
  description?: string;
  status: 'active' | 'claimed' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  claimed_at?: string;
}

export const secureLinksService = {
  /**
   * Create a new payment link
   * @param amount Amount in kobo (e.g., 100000 = ₦1,000)
   * @param description Optional description
   */
  async createLink(amount: number, description?: string): Promise<SecureLink> {
    const { data, error } = await supabase.rpc('create_payment_link', {
      p_amount: amount,
      p_description: description || null,
    });

    if (error) {
      console.error('Error creating payment link:', error);
      throw new Error(error.message || 'Failed to create payment link');
    }

    if (!data) {
      throw new Error('No data returned from create_payment_link');
    }

    return {
      id: data.link_id,
      link_code: data.link_code,
      amount: data.amount,
      description: description,
      status: data.status,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  /**
   * Claim a payment link
   * @param linkCode The 8-character link code
   * @param passcode The 4-digit passcode
   */
  async claimLink(linkCode: string, passcode: string): Promise<{ success: boolean; amount: number; message: string }> {
    const { data, error } = await supabase.rpc('claim_payment_link', {
      p_link_code: linkCode.toUpperCase(),
      p_passcode: passcode,
    });

    if (error) {
      console.error('Error claiming payment link:', error);
      throw new Error(error.message || 'Failed to claim payment link');
    }

    if (!data) {
      throw new Error('No data returned from claim_payment_link');
    }

    return data;
  },

  /**
   * Get user's created links
   */
  async getUserLinks(): Promise<SecureLink[]> {
    const { data, error } = await supabase
      .from('secure_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user links:', error);
      throw new Error('Failed to fetch payment links');
    }

    return data || [];
  },

  /**
   * Cancel a payment link
   * @param linkId The link ID
   */
  async cancelLink(linkId: string): Promise<void> {
    const { error } = await supabase
      .from('secure_links')
      .update({ status: 'cancelled' })
      .eq('id', linkId)
      .eq('status', 'active');

    if (error) {
      console.error('Error cancelling payment link:', error);
      throw new Error('Failed to cancel payment link');
    }
  },
};
