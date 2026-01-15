-- Fix for create_payment_link to match alphabetical parameter order (p_amount, p_description, p_passcode)
-- This avoids PostgREST cache issues.

CREATE OR REPLACE FUNCTION public.create_payment_link(
    p_amount BIGINT,
    p_description TEXT,
    p_passcode TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance BIGINT;
    v_link_code TEXT;
    v_link_id UUID;
    v_passcode_hash TEXT;
BEGIN
    -- Get user's wallet
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM public.wallets
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    -- Check if user has sufficient balance
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Generate unique 8-character link code
    v_link_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
    
    -- Hash the provided 4-digit passcode
    v_passcode_hash := MD5(p_passcode || 'salt');

    -- Deduct amount from wallet
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Create the link
    INSERT INTO public.secure_links (
        creator_wallet_id,
        amount,
        passcode_hash,
        link_code,
        description,
        status
    ) VALUES (
        v_wallet_id,
        p_amount,
        v_passcode_hash,
        v_link_code,
        p_description,
        'active'
    )
    RETURNING id INTO v_link_id;

    -- Record transaction
    INSERT INTO public.transactions (
        wallet_id,
        amount,
        type,
        description,
        category,
        reference,
        status
    ) VALUES (
        v_wallet_id,
        -p_amount,
        'debit',
        COALESCE(p_description, 'Secure Link Created'),
        'Transfer',
        'LINK_' || v_link_code,
        'success'
    );

    -- Return link details
    RETURN json_build_object(
        'link_id', v_link_id,
        'link_code', v_link_code,
        'amount', p_amount,
        'status', 'active'
    );
END;
$$;
