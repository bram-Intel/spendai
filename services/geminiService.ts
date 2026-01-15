import { supabase } from '../lib/supabase';

// Phase 4: Secure Gemini API - All calls go through Edge Function
export const geminiService = {
  async askFinancialAdvisor(prompt: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('You must be logged in to use the financial advisor');
    }

    const { data, error } = await supabase.functions.invoke('ask-financial-advisor', {
      body: { prompt },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error('AI Advisor Error:', error);
      throw new Error(`Failed to get advice: ${error.message}`);
    }

    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to get advice');
    }

    return data.response;
  }
};

// Legacy function for backward compatibility (now uses Edge Function)
export const getFinancialAdvice = async (
  userQuery: string
): Promise<string> => {
  return geminiService.askFinancialAdvisor(userQuery);
};
