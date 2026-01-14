
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

serve(async (req) => {
    try {
        const signature = req.headers.get('x-paystack-signature')
        const secret = Deno.env.get('PAYSTACK_SECRET_KEY')

        if (!signature || !secret) {
            return new Response("Missing signature or config", { status: 400 })
        }

        const body = await req.text() // Read text for HMAC verification

        // Verify Signature
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const msgData = encoder.encode(body);
        const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["verify"]);

        // Web crypto verify requires the signature to be ArrayBuffer
        // but Paystack sends hex string. Convert hex to buffer.
        const signatureBuffer = new Uint8Array(signature.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16)));

        const isValid = await crypto.subtle.verify("HMAC", cryptoKey, signatureBuffer, msgData);

        if (!isValid) {
            return new Response("Invalid Signature", { status: 401 })
        }

        const event = JSON.parse(body)

        if (event.event === 'charge.success') {
            const { customer, validation, amount, reference, channel } = event.data

            // We only care if it's a dedicated account transfer usually, but charge.success works for all.
            // We need to match the customer to a user.
            // We stored 'paystack_customer_code' in wallets.

            const customerCode = customer.customer_code;

            const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            )

            // 1. Find Wallet
            const { data: wallet, error: walletError } = await supabaseAdmin
                .from('wallets')
                .select('id, balance, user_id')
                .eq('paystack_customer_code', customerCode)
                .single()

            if (walletError || !wallet) {
                console.error("Wallet not found for customer:", customerCode)
                return new Response("Wallet not found", { status: 200 }) // Return 200 to acknowledge webhook
            }

            // 2. Check if transaction already recorded (idempotency)
            const { data: existingTx } = await supabaseAdmin
                .from('transactions')
                .select('id')
                .eq('reference', reference)
                .single()

            if (existingTx) {
                return new Response("Transaction already processed", { status: 200 })
            }

            // 3. Credit Wallet & Record Transaction
            // Use RPC if concurrency is a concern, or simple update for MVP.
            // Supabase/Postgres doesn't support easy atomic increments without RPC or intricate queries in client.
            // We will assume normal update for now or just standard insert.

            const newBalance = (wallet.balance || 0) + amount; // Amount is already kobo from Paystack

            const { error: txError } = await supabaseAdmin
                .from('transactions')
                .insert({
                    wallet_id: wallet.id,
                    amount: amount,
                    type: 'credit',
                    description: `Deposit via ${channel}`,
                    category: 'deposit',
                    reference: reference,
                    status: 'success'
                })

            if (!txError) {
                await supabaseAdmin
                    .from('wallets')
                    .update({ balance: newBalance })
                    .eq('id', wallet.id)
            } else {
                console.error("Failed to record transaction:", txError)
                return new Response("Db Error", { status: 500 })
            }
        }

        return new Response("Webhook received", { status: 200 })

    } catch (error) {
        console.error(error)
        return new Response(`Error: ${error.message}`, { status: 400 })
    }
})
