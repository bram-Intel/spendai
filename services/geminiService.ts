import { supabase } from '../lib/supabase';

// Phase 4: Secure Gemini API - All calls go through Edge Function
export const geminiService = {
  async askFinancialAdvisor(prompt: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in to use the financial advisor');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const functionUrl = `${supabaseUrl}/functions/v1/ask-financial-advisor`;

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) {
          // not json
        }

        console.error('AI Advisor Raw Error:', response.status, errorText);
        throw new Error(errorJson?.error || errorJson?.message || `Server error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error: any) {
      console.error('AI Advisor Fetch Error:', error);
      throw error; // Re-throw to be caught by UI
    }
  }
};

// Legacy function for backward compatibility (now uses Edge Function)
export const getFinancialAdvice = async (
  userQuery: string
): Promise<string> => {
  return geminiService.askFinancialAdvisor(userQuery);
};
