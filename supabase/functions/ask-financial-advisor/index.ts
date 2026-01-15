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

    // Fetch last 5 transactions
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, type, description, category, created_at')
      .eq('wallet_id', userData.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (txError) {
      console.error('Error fetching transactions:', txError);
    }

    // Convert balance from kobo to naira
    const balanceNaira = (userData.balance || 0) / 100;

    // Build context for Gemini
    const transactionSummary = transactions && transactions.length > 0
      ? transactions.map(tx => {
        const amountNaira = tx.amount / 100;
        return `- ${tx.type === 'credit' ? '+' : '-'}₦${Math.abs(amountNaira).toFixed(2)} (${tx.category || 'Other'}): ${tx.description || 'No description'}`;
      }).join('\n')
      : 'No recent transactions';

    const systemPrompt = `You are a helpful financial advisor for Spend.AI, a Nigerian fintech app. 
You provide personalized financial advice based on the user's wallet balance and transaction history.

User's Current Financial Status:
- Wallet Balance: ₦${balanceNaira.toFixed(2)}
- Recent Transactions:
${transactionSummary}

Guidelines:
- Be concise and practical
- Use Nigerian context (Naira currency, local financial practices)
- Provide actionable advice
- Be encouraging and supportive
- If the user asks about features not related to their finances, politely redirect them
- Never make up transaction data or balance information

User's Question: ${prompt}`;

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
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
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        context: {
          balance: balanceNaira,
          transactionCount: transactions?.length || 0,
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
