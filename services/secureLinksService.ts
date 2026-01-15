import { supabase } from '../lib/supabase';
import { SecureLink } from '../types';

export const secureLinksService = {
  /**
   * Create a new payment link
   * @param amount Amount in kobo (e.g., 100000 = ₦1,000)
   * @param passcode The 4-digit passcode
   * @param description Optional description
   */
  async createLink(amount: number, passcode: string, description?: string): Promise<SecureLink> {
    const { data, error } = await (supabase as any).rpc('create_payment_link', {
      p_amount: amount,
      p_passcode: passcode,
      p_description: description || null,
    });

    if (error) {
      console.error('Error creating payment link:', error);
      throw new Error(error.message || 'Failed to create payment link');
    }

    if (!data) {
      throw new Error('No data returned from create_payment_link');
    }

    const response = data as any;

    return {
      id: response.link_id,
      link_code: response.link_code,
      amount: response.amount / 100, // Convert kobo to naira for frontend
      description: description,
      status: response.status,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Claim a payment link
   * @param linkCode The 8-character link code
   * @param passcode The 4-digit passcode
   */
  async claimLink(linkCode: string, passcode: string): Promise<{ success: boolean; amount: number; message: string }> {
    const { data, error } = await (supabase as any).rpc('claim_payment_link', {
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

    const result = data as any;
    return {
      ...result,
      amount: result.amount / 100 // Convert kobo to naira
    };
  },

  /**
   * Get user's created links
   */
  async getUserLinks(): Promise<SecureLink[]> {
    const { data, error } = await (supabase as any)
      .from('secure_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user links:', error);
      throw new Error('Failed to fetch payment links');
    }

    return (data || []).map((link: any) => ({
      id: link.id,
      link_code: link.link_code,
      amount: link.amount / 100,
      description: link.description,
      status: link.status,
      createdAt: link.created_at,
      expires_at: link.expires_at
    }));
  },

  /**
   * Cancel a payment link
   * @param linkId The link ID
   */
  async cancelLink(linkId: string): Promise<void> {
    const { error } = await (supabase as any)
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
