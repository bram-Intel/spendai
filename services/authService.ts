import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthResult {
  user: User | null
  session: Session | null
  error: Error | null
}

export const authService = {
  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string, fullName: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        return { user: null, session: null, error }
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      }
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error as Error,
      }
    }
  },

  /**
   * Sign in an existing user with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { user: null, session: null, error }
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      }
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error as Error,
      }
    }
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  },

  /**
   * Get the current session
   */
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session)
    })
  },
}
