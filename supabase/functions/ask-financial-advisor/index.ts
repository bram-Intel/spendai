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
2. **Action Intent Detection - PARSE NATURAL LANGUAGE**:
   - **INITIATE_TRANSFER**: Detect when user wants to send money. Examples:
     * "send 5k to 109343434 union bank abraham okezie" → amount: 5000, account: 109343434, bank: union bank, name: abraham okezie
     * "pay 10000 to gtbank 0011223344" → amount: 10000, account: 0011223344, bank: gtbank
     * "transfer 2.5k to my sister's opay 8123456789" → amount: 2500, account: 8123456789, bank: opay
     * "send money to zenith 0033445566 john doe" → amount: null (ask), account: 0033445566, bank: zenith, name: john doe
   - **CREATE_LINK**: Detect payment link requests. Examples:
     * "create a 5k link" → amount: 5000
     * "generate link for 10000 naira" → amount: 10000
3. **Amount Parsing Rules**:
   - "5k" or "5K" → 5000
   - "10k" or "10K" → 10000
   - "2.5k" or "2.5K" → 2500
   - "1k" or "1K" → 1000
   - If amount is missing, set to null and ask user in response
4. **Bank Name Normalization**: Extract bank name from phrases like "union bank", "gtbank", "zenith bank", "opay", "palmpay", "first bank", etc.
5. **Account Number Extraction**: Find 10-digit numbers in the text.
6. **Account Name Extraction**: Any additional names after bank/account details.

OUTPUT SCHEMA (STRICT JSON):
You must ALWAYS respond with this JSON structure:
{
  "response": "Your concise, friendly Nigerian-style confirmation message... If amount is missing, ask for it. If details are unclear, ask for clarification.",
  "action": null | {
    "type": "CREATE_LINK" | "INITIATE_TRANSFER",
    "params": {
       // CREATE_LINK: amount (number, required), description (string, optional)
       // INITIATE_TRANSFER: account_number (string, 10 digits), bank_name (string), amount (number, null if not found), account_name (string, optional)
    }
  }
}

NIGERIAN BANKING CONTEXT:
- OPay, PalmPay, Moniepoint, Kuda are digital banks.
- Account numbers are 10 digits (9 digits for some fintechs like OPay).
- Common banks: Access, GTBank, Zenith, First Bank, UBA, Union Bank, Fidelity, Ecobank, Sterling, Wema, Polaris, Keystone.
- Propose the transfer IMMEDIATELY if you detect clear intent with sufficient details.

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
