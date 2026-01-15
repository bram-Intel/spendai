-- Migration: Add PIN security and extend links for Payment Delegation

-- 1. Add pin_hash to profiles for transaction security
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- 2. Extend secure_links to support dynamic requests
ALTER TABLE public.secure_links 
ADD COLUMN IF NOT EXISTS amount_limit BIGINT,
ADD COLUMN IF NOT EXISTS requested_amount BIGINT,
ADD COLUMN IF NOT EXISTS target_account_number TEXT,
ADD COLUMN IF NOT EXISTS target_bank_name TEXT,
ADD COLUMN IF NOT EXISTS target_bank_code TEXT,
ADD COLUMN IF NOT EXISTS target_account_name TEXT;

-- Update status constraint to include pending_approval and rejected
ALTER TABLE public.secure_links DROP CONSTRAINT IF EXISTS secure_links_status_check;
ALTER TABLE public.secure_links ADD CONSTRAINT secure_links_status_check 
CHECK (status IN ('active', 'pending_approval', 'approved', 'rejected', 'claimed', 'expired', 'cancelled'));

-- 3. Add a helper function for PIN verification (simple hash for MVP)
CREATE OR REPLACE FUNCTION public.verify_wallet_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin_hash TEXT;
BEGIN
    SELECT pin_hash INTO v_pin_hash FROM public.profiles WHERE id = auth.uid();
    -- Simple hash check - in production use pgcrypto for crypt/bf
    RETURN v_pin_hash = MD5(p_pin || 'wallet_salt');
END;
$$;

-- 4. Function for recipient to submit a payment request
CREATE OR REPLACE FUNCTION public.submit_payment_request(
    p_link_code TEXT,
    p_passcode TEXT,
    p_amount BIGINT,
    p_target_account_number TEXT,
    p_target_bank_name TEXT,
    p_target_bank_code TEXT DEFAULT NULL,
    p_target_account_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link RECORD;
    v_passcode_hash TEXT;
BEGIN
    -- Get link details
    SELECT * INTO v_link
    FROM public.secure_links
    WHERE link_code = UPPER(p_link_code)
    AND status = 'active'
    AND expires_at > NOW()
    FOR UPDATE;

    IF v_link IS NULL THEN
        RAISE EXCEPTION 'Link not found or not active';
    END IF;

    -- Verify passcode
    v_passcode_hash := MD5(p_passcode || 'salt');
    IF v_link.passcode_hash != v_passcode_hash THEN
        RAISE EXCEPTION 'Invalid passcode';
    END IF;

    -- Check if amount exceeds limit (if set)
    IF v_link.amount_limit IS NOT NULL AND p_amount > v_link.amount_limit THEN
        RAISE EXCEPTION 'Amount exceeds link limit of ₦%', (v_link.amount_limit / 100);
    END IF;

    -- Update link with request details
    UPDATE public.secure_links
    SET 
        requested_amount = p_amount,
        target_account_number = p_target_account_number,
        target_bank_name = p_target_bank_name,
        target_bank_code = p_target_bank_code,
        target_account_name = p_target_account_name,
        status = 'pending_approval',
        updated_at = NOW()
    WHERE id = v_link.id;

    RETURN json_build_object(
        'success', true,
        'message', 'Payment request submitted. Waiting for owner approval.'
    );
END;
$$;

-- 5. Function for owner to approve a payment request
CREATE OR REPLACE FUNCTION public.approve_payment_request(
    p_link_id UUID,
    p_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link RECORD;
    v_wallet_id UUID;
    v_current_balance BIGINT;
BEGIN
    -- Verify PIN
    IF NOT public.verify_wallet_pin(p_pin) THEN
        RAISE EXCEPTION 'Invalid transaction PIN';
    END IF;

    -- Get link and lock
    SELECT * INTO v_link
    FROM public.secure_links
    WHERE id = p_link_id
    AND status = 'pending_approval'
    FOR UPDATE;

    IF v_link IS NULL THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    -- Get owner's wallet
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM public.wallets
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- Security: Ensure the link belongs to this user's wallet
    IF v_link.creator_wallet_id != v_wallet_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Check balance
    IF v_current_balance < v_link.requested_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- 1. Deduct funds
    UPDATE public.wallets
    SET balance = balance - v_link.requested_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- 2. Record transaction
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
        -v_link.requested_amount,
        'debit',
        'Delegated Pay: ' || v_link.target_bank_name,
        'Transfer',
        'REQ_' || v_link.link_code,
        'success'
    );

    -- 3. Mark link as approved (claimed)
    UPDATE public.secure_links
    SET 
        status = 'approved',
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_link_id;

    RETURN json_build_object(
        'success', true,
        'amount', v_link.requested_amount,
        'target', v_link.target_account_number
    );
END;
$$;
