
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Get User
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            throw new Error('Unauthorized')
        }

        const { prompt } = await req.json()

        if (!prompt) {
            throw new Error('Prompt is required')
        }

        // 2. Fetch Context (Balance & Transactions)
        // We can use the service role key to ensure we get everything, but RLS should allow the user to read their own data.
        // Let's use the authenticated client to respect RLS.

        // Fetch Wallet
        const { data: wallet } = await supabaseClient
            .from('wallets')
            .select('*')
            .eq('user_id', user.id)
            .single()

        // Fetch Recent Transactions
        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('wallet_id', wallet?.id)
            .order('created_at', { ascending: false })
            .limit(5)

        const balanceNaira = wallet ? (wallet.balance / 100).toFixed(2) : '0.00';
        const txContext = transactions?.map((t: any) =>
            `- ${t.type.toUpperCase()}: ₦${(t.amount / 100).toFixed(2)} (${t.description})`
        ).join('\n') || "No recent transactions.";

        // 3. Construct System Prompt
        const systemPrompt = `You are a helpful and wise financial advisor for the Spend.AI app.
    The user's current balance is ₦${balanceNaira}.
    Their recent transactions are:
    ${txContext}
    
    Answer the user's question based on this context if relevant. 
    Be concise, friendly, and use formatting.`;

        // 4. Call Gemini API
        const geminiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiKey) throw new Error('GEMINI_API_KEY not configured')

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt + "\n\nUser Question: " + prompt }]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

        return new Response(
            JSON.stringify({ response: aiText }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
