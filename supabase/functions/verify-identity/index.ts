
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Get the user from the authorization header
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('Unauthorized')
        }

        const { bvn, dob } = await req.json()

        if (!bvn || bvn.length !== 11) {
            throw new Error('Invalid BVN')
        }

        // Call Paystack API to resolve BVN
        // NOTE: In a real production app, you might want to match the DOB and Name returned by Paystack 
        // against what the user provided or what is in their profile.
        // For this MVP, we are effectively just checking if the BVN is valid at Paystack.

        const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')
        if (!paystackSecret) {
            throw new Error("Server configuration error: PAYSTACK_SECRET_KEY not set")
        }

        // In test mode, Paystack doesn't support BVN verification
        // So we bypass the API call and simulate success for any valid 11-digit BVN
        const isTestMode = paystackSecret.startsWith('sk_test_')

        let paystackData: any = {}

        if (isTestMode) {
            // Simulate successful BVN verification in test mode
            console.log('Test mode: Bypassing Paystack BVN verification')
            paystackData = {
                status: true,
                message: 'BVN verified (test mode)',
                data: {
                    first_name: 'Test',
                    last_name: 'User',
                    dob: dob,
                    bvn: bvn
                }
            }
        } else {
            // Production mode: Call actual Paystack API
            const paystackResponse = await fetch(`https://api.paystack.co/bank/resolve_bvn/${bvn}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${paystackSecret}`,
                },
            })

            paystackData = await paystackResponse.json()

            if (!paystackResponse.ok || !paystackData.status) {
                console.error('Paystack error:', paystackData)
                throw new Error(paystackData.message || 'Verification failed')
            }
        }

        // If verification successful, update the user's profile
        // We need to use the Service Role Key to update the profile if RLS doesn't allow users to verify themselves directly
        // OR we can just use the authenticated client if the RLS allows updates to 'kyc_verified' by the owner.
        // Based on the setup, users can update their own profile.

        // Ideally, we shouldn't trust the client to just set 'kyc_verified' to true directly via the API.
        // So this Edge Function acts as the trusted authority. 
        // We should use the ADMIN (Service Role) client to perform this update to ensure it's not spoofed, 
        // in case we tighten RLS later to prevent users from setting 'kyc_verified'.

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ kyc_verified: true, kyc_tier: 1 })
            .eq('id', user.id)

        if (updateError) {
            throw updateError
        }

        // Trigger Virtual Account Creation
        // We call the function internally.
        // Note: In production you might want to use a Database Trigger or a Message Queue
        // to decouple this, so KYC doesn't fail if Account Creation is slow.
        // For MVP, we await it (or fire and forget).

        // We use the Function URL. 
        // Assuming deployed to the same project.
        const projectUrl = Deno.env.get('SUPABASE_URL')
        // Extract project ID if needed or just construct URL standardly? 
        // Standard: https://<project_ref>.supabase.co/functions/v1/create-virtual-account

        // Easier way: Use the supabaseAdmin client's invoke if supported, or just fetch.
        // 'invoke' is on the client.

        try {
            await supabaseAdmin.functions.invoke('create-virtual-account', {
                body: { user_id: user.id }
            })
        } catch (err) {
            console.error("Failed to trigger account creation:", err)
            // We do NOT fail the KYC verification response here, because KYC itself was successful.
            // The user might just not get an account immediately.
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Identity verified successfully', data: paystackData.data }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
