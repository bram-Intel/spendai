import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AskAdvisorRequest {
  prompt: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header found in request' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User validation failed', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { prompt }: AskAdvisorRequest = await req.json();

    if (!prompt || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Gemini API key
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's wallet and recent transactions
    let userData = null;
    try {
      const { data, error: dataError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .single();

      if (dataError) {
        console.warn('Wallet not found or access denied:', dataError);
      } else {
        userData = data;
      }
    } catch (e) {
      console.warn('Exception fetching wallet:', e);
    }

    // Fetch detailed spending context
    let spendingSummary = null;
    let detailedHistory = [];

    if (userData) {
      try {
        const { data: summary, error: summaryError } = await supabase.rpc('get_ai_spending_summary', { p_wallet_id: userData.id });
        if (!summaryError) spendingSummary = summary;

        const { data: history, error: historyError } = await supabase.rpc('get_ai_detailed_history', { p_wallet_id: userData.id, p_limit: 20 });
        if (!historyError) detailedHistory = history;
      } catch (e) {
        console.warn('Error calling context RPCs:', e);
      }
    }

    const historyText = detailedHistory && detailedHistory.length > 0
      ? detailedHistory.map((tx: any) => {
        const amountNaira = tx.amount / 100;
        return `- [${new Date(tx.created_at).toLocaleDateString()}] ${tx.type === 'credit' ? '+' : '-'}₦${Math.abs(amountNaira).toLocaleString()} (${tx.category}): ${tx.description}`;
      }).join('\n')
      : 'No recent transactions';

    const summaryText = spendingSummary
      ? `Total Spending this month: ₦${(spendingSummary.total_spending / 100).toLocaleString()}`
      : 'No spending summary available';

    // Convert balance from kobo to naira
    const balanceNaira = userData ? (userData.balance || 0) / 100 : 0;

    const systemPrompt = `You are the AUTHORIZED AI TRANSACTION AGENT for Spend.AI (Nigeria).
Your primary job is to help users manage money by PROPOSING ACTIONS directly in the app.

USER'S FINANCIAL CONTEXT:
- Real-time Balance: ₦${balanceNaira.toLocaleString()}
- ${summaryText}
- Transaction History (last 20):
${historyText}

YOUR MANDATE:
1. **Be Agentic**: Do NOT say you cannot process transactions. You CAN propose them.
2. **Action Intent Detection**: 
   - If the user mentions an account number and bank (e.g., "Pay 5k to 123456 Zenith"), propose INITIATE_TRANSFER.
   - If the user asks for a payment link (e.g., "Create a 5k link"), propose CREATE_LINK.
3. **Conversational Analysis**: If they ask about spending, perform the analysis using the context.

OUTPUT SCHEMA (STRICT JSON):
You must ALWAYS respond with this JSON structure:
{
  "response": "Your concise, friendly Nigerian-style confirmation message...",
  "action": null | {
    "type": "CREATE_LINK" | "INITIATE_TRANSFER",
    "params": {
       // CREATE_LINK: amount (number), description (string)
       // INITIATE_TRANSFER: account_number (string), bank_name (string), amount (number), account_name (string, if detected)
    }
  }
}

NIGERIAN BANKING CONTEXT:
- OPay, PalmPay, Moniepoint are common.
- Account numbers are 10 digits.
- Propose the transfer IMMEDIATELY if you see the bank details.

User's Input: ${prompt}`;

    console.log('Calling Gemini API for user:', user.id);

    // Call Gemini API - Using v1beta and gemini-flash-latest as verified in tests
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            response_mime_type: "application/json"
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error details:', errorText);

      return new Response(
        JSON.stringify({
          error: 'Failed to get response from AI advisor',
          details: errorText,
          status: geminiResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{"response": "Sorry, I could not generate a response.", "action": null}';

    // Parse the JSON string from Gemini
    let resultJson;
    try {
      resultJson = JSON.parse(resultText);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', resultText, e);
      resultJson = { response: resultText, action: null };
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        response: resultJson.response,
        action: resultJson.action,
        context: {
          balance: balanceNaira,
          hasWallet: !!userData,
          historyCount: detailedHistory?.length || 0,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('CRITICAL Error in ask-financial-advisor:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
