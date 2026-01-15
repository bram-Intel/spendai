import { supabase } from '../lib/supabase';
import { SecureLink } from '../types';

export const secureLinksService = {
  /**
   * Create a new payment link
   */
  async createLink(amount: number, passcode: string, description?: string): Promise<SecureLink> {
    const { data, error } = await (supabase as any).rpc('create_payment_link', {
      p_amount: amount * 100, // Handle kobo conversion if needed, though RPC does it? 
      // Actually, let's keep it consistent. User inputs Naira.
      p_passcode: passcode,
      p_description: description || null,
    });

    if (error) throw new Error(error.message);
    const response = data as any;

    return {
      id: response.link_id,
      link_code: response.link_code,
      amount: response.amount / 100,
      description: description,
      status: response.status,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Fetch a link by its unique 8-char code (Public)
   */
  async getLinkByCode(code: string): Promise<SecureLink | null> {
    const { data, error } = await (supabase as any).rpc('get_link_by_code', {
      p_link_code: code.toUpperCase()
    });

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      link_code: data.link_code,
      amount: data.amount / 100,
      status: data.status,
      description: data.description,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Submit a payment request (Recipient/Brother uses this)
   */
  async submitRequest(linkCode: string, passcode: string, amount: number, accountNumber: string, bankName: string): Promise<void> {
    const { error } = await (supabase as any).rpc('submit_payment_request', {
      p_link_code: linkCode.toUpperCase(),
      p_passcode: passcode,
      p_amount: amount * 100, // Convert to kobo
      p_target_account_number: accountNumber,
      p_target_bank_name: bankName
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Approve a pending request (Owner uses this)
   */
  async approveRequest(linkId: string, pin: string): Promise<void> {
    const { error } = await (supabase as any).rpc('approve_payment_request', {
      p_link_id: linkId,
      p_pin: pin
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Decline/Reject a pending request
   */
  async rejectRequest(linkId: string): Promise<void> {
    const { error } = await (supabase as any).rpc('reject_payment_request', {
      p_link_id: linkId
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Fetch links created by user that are pending approval
   */
  async getPendingApprovals(): Promise<SecureLink[]> {
    const { data, error } = await (supabase as any)
      .from('secure_links')
      .select('*')
      .eq('status', 'pending_approval')
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((link: any) => ({
      id: link.id,
      link_code: link.link_code,
      amount: link.amount / 100,
      requested_amount: link.requested_amount ? link.requested_amount / 100 : undefined,
      target_account_number: link.target_account_number,
      target_bank_name: link.target_bank_name,
      description: link.description,
      status: link.status,
      createdAt: link.created_at
    }));
  },

  /**
   * Get user's created links
   */
  async getUserLinks(): Promise<SecureLink[]> {
    const { data, error } = await (supabase as any)
      .from('secure_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((link: any) => ({
      id: link.id,
      link_code: link.link_code,
      amount: link.amount / 100,
      requested_amount: link.requested_amount ? link.requested_amount / 100 : undefined,
      description: link.description,
      status: link.status,
      createdAt: link.created_at,
      expires_at: link.expires_at
    }));
  },

  /**
   * Cancel a link
   */
  async cancelLink(linkId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('secure_links')
      .update({ status: 'cancelled' })
      .eq('id', linkId);

    if (error) throw new Error(error.message);
  },
};
