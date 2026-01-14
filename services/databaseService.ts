import { supabase } from '../lib/supabase'
import type { Database } from '../types/supabase'

type DbProfile = Database['public']['Tables']['profiles']['Row']
type DbWallet = Database['public']['Tables']['wallets']['Row']
type DbTransaction = Database['public']['Tables']['transactions']['Row']
type NewTransaction = Database['public']['Tables']['transactions']['Insert']

export interface UserData {
  profile: DbProfile
  wallet: DbWallet
  recentTransactions: DbTransaction[]
}

export const databaseService = {
  /**
   * Get user profile by user ID
   */
  async getProfile(userId: string): Promise<DbProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  },

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<DbProfile>
  ): Promise<DbProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return null
    }

    return data
  },

  /**
   * Get user wallet by user ID
   */
  async getWallet(userId: string): Promise<DbWallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching wallet:', error)
      return null
    }

    return data
  },

  /**
   * Update wallet balance
   */
  async updateWalletBalance(
    walletId: string,
    amount: number
  ): Promise<DbWallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .update({ balance: amount })
      .eq('id', walletId)
      .select()
      .single()

    if (error) {
      console.error('Error updating wallet balance:', error)
      return null
    }

    return data
  },

  /**
   * Get transactions for a wallet
   */
  async getTransactions(
    walletId: string,
    limit: number = 10
  ): Promise<DbTransaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching transactions:', error)
      return []
    }

    return data || []
  },

  /**
   * Create a new transaction
   */
  async createTransaction(
    transaction: NewTransaction
  ): Promise<DbTransaction | null> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      return null
    }

    return data
  },

  /**
   * Get all user data (profile, wallet, recent transactions)
   */
  async getUserData(userId: string): Promise<UserData | null> {
    try {
      // Fetch profile
      const profile = await this.getProfile(userId)
      if (!profile) {
        throw new Error('Profile not found')
      }

      // Fetch wallet
      const wallet = await this.getWallet(userId)
      if (!wallet) {
        throw new Error('Wallet not found')
      }

      // Fetch recent transactions
      const recentTransactions = await this.getTransactions(wallet.id, 5)

      return {
        profile,
        wallet,
        recentTransactions,
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      return null
    }
  },
}
