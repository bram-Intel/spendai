import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  account_number: string;
  bank_name: string;
  amount: number; // in Naira
  account_name?: string;
  reason?: string;
}

// Nigerian bank codes mapping
const BANK_CODES: Record<string, string> = {
  'access bank': '044',
  'access': '044',
  'gtbank': '058',
  'gt bank': '058',
  'guaranty trust bank': '058',
  'zenith': '057',
  'zenith bank': '057',
  'first bank': '011',
  'firstbank': '011',
  'uba': '033',
  'united bank for africa': '033',
  'union bank': '032',
  'union': '032',
  'fidelity': '070',
  'fidelity bank': '070',
  'ecobank': '050',
  'sterling': '232',
  'sterling bank': '232',
  'wema': '035',
  'wema bank': '035',
  'alat': '035',
  'polaris': '076',
  'polaris bank': '076',
  'keystone': '082',
  'keystone bank': '082',
  'unity': '215',
  'unity bank': '215',
  'jaiz': '301',
  'jaiz bank': '301',
  'opay': '999992',
  'palmpay': '999993',
  'moniepoint': '999990',
  'kuda': '999991',
};

function getBankCode(bankName: string): string | null {
  const normalized = bankName.toLowerCase().trim();
  return BANK_CODES[normalized] || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: TransferRequest = await req.json();
    const { account_number, bank_name, amount, account_name, reason } = body;

    // Validation
    if (!account_number || !bank_name || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: account_number, bank_name, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < 100) {
      return new Response(
        JSON.stringify({ error: 'Minimum transfer amount is ₦100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance, paystack_customer_code')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountKobo = Math.round(amount * 100);

    // Check balance
    if (wallet.balance < amountKobo) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          balance: wallet.balance / 100,
          requested: amount
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    const isTestMode = !paystackSecret || paystackSecret.startsWith('sk_test_');

    let transferResult;

    if (isTestMode) {
      // Test mode: Simulate successful transfer
      console.log('Test mode: Simulating transfer');
      
      // Deduct from wallet
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amountKobo })
        .eq('id', wallet.id);

      if (updateError) {
        throw new Error('Failed to update wallet balance');
      }

      // Record transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          amount: -amountKobo,
          type: 'debit',
          description: `Transfer to ${account_name || account_number} (${bank_name})`,
          category: 'Transfer',
          reference: `sim_${Date.now()}`,
          status: 'success',
        })
        .select()
        .single();

      if (txError) {
        console.error('Failed to record transaction:', txError);
      }

      transferResult = {
        status: 'success',
        reference: `sim_${Date.now()}`,
        amount: amount,
        recipient: {
          account_number,
          bank_name,
          account_name: account_name || 'Unknown',
        }
      };
    } else {
      // Production: Call Paystack
      const bankCode = getBankCode(bank_name);
      
      if (!bankCode) {
        return new Response(
          JSON.stringify({ error: `Unknown bank: ${bank_name}. Please use a supported bank.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First, verify the account number
      const verifyResponse = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bankCode}`,
        {
          headers: {
            'Authorization': `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const verifyData = await verifyResponse.json();
      
      if (!verifyData.status) {
        return new Response(
          JSON.stringify({ error: 'Account verification failed', details: verifyData.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resolvedName = verifyData.data.account_name;

      // Create transfer recipient
      const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: resolvedName,
          account_number,
          bank_code: bankCode,
          currency: 'NGN',
        }),
      });

      const recipientData = await recipientResponse.json();
      
      if (!recipientData.status) {
        throw new Error('Failed to create transfer recipient: ' + recipientData.message);
      }

      const recipientCode = recipientData.data.recipient_code;

      // Initiate transfer
      const transferResponse = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: amountKobo,
          recipient: recipientCode,
          reason: reason || 'Spend.AI Transfer',
        }),
      });

      const transferData = await transferResponse.json();

      if (!transferData.status) {
        return new Response(
          JSON.stringify({ error: 'Transfer failed', details: transferData.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct from wallet and record transaction
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amountKobo })
        .eq('id', wallet.id);

      if (updateError) {
        throw new Error('Failed to update wallet balance');
      }

      await supabase.from('transactions').insert({
        wallet_id: wallet.id,
        amount: -amountKobo,
        type: 'debit',
        description: `Transfer to ${resolvedName} (${bank_name})`,
        category: 'Transfer',
        reference: transferData.data.reference,
        status: 'pending', // Paystack transfers start as pending
      });

      transferResult = {
        status: 'pending',
        reference: transferData.data.reference,
        transfer_code: transferData.data.transfer_code,
        amount: amount,
        recipient: {
          account_number,
          bank_name,
          account_name: resolvedName,
        }
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: transferResult,
        new_balance: (wallet.balance - amountKobo) / 100,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Transfer error:', error);
    return new Response(
      JSON.stringify({ error: 'Transfer failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
