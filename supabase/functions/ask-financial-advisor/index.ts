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
    const { data: userData, error: dataError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', user.id)
      .single();

    if (dataError) {
      console.error('Error fetching wallet:', dataError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch detailed spending context
    const { data: spendingSummary, error: summaryError } = await supabase.rpc('get_ai_spending_summary', { p_wallet_id: userData.id });
    const { data: detailedHistory, error: historyError } = await supabase.rpc('get_ai_detailed_history', { p_wallet_id: userData.id, p_limit: 20 });

    if (summaryError || historyError) {
      console.error('Error fetching context:', summaryError || historyError);
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
    const balanceNaira = (userData.balance || 0) / 100;

    const systemPrompt = `You are a powerful agentic financial advisor for Spend.AI (Nigeria). 
You have TWO modes:
1. **CONVERSATIONAL**: Answer questions about spending, budgeting, and general finance.
2. **ACTION**: Propose a specific action inside the app.

User's Financial Context:
- Current Balance: ₦${balanceNaira.toLocaleString()}
- ${summaryText}
- Recent detailed history (20 transactions):
${historyText}

Capabilities:
- **Analyze Spending**: If the user asks about their spending, use the provided history/summary.
- **Propose Link**: Detect if user wants to create a secure link (e.g., "Generate a payment link for my brother for 5k").
- **Detect Transfer**: Detect if user pasted bank details (e.g., "Send 10k to 0123456789 Zenith Bank").

Output Format:
You MUST respond in JSON format if you are proposing an action, or a simple text response.
Actually, ALWAYS respond with this JSON schema:
{
  "response": "Your natural language message here...",
  "action": null | {
    "type": "CREATE_LINK" | "INITIATE_TRANSFER",
    "params": {
       // for CREATE_LINK: amount, description
       // for INITIATE_TRANSFER: account_number, bank_name, account_name (if detected), amount
    }
  }
}

Important for transfers:
Bank details in Nigeria often look like "Account Number + Bank Name". If you see this, automatically propose an INITIATE_TRANSFER action.

User's Message: ${prompt}`;

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.2, // Lower temperature for more consistent JSON
            maxOutputTokens: 1000,
            response_mime_type: "application/json"
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);

      return new Response(
        JSON.stringify({
          error: 'Failed to get response from AI advisor',
          details: errorText
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
      console.error('Failed to parse Gemini response as JSON:', resultText);
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
          historyCount: detailedHistory?.length || 0,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ask-financial-advisor function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
