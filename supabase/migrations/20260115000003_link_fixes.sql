-- Migration: Rejection logic and public link fetching

-- 1. Function to reject a payment request (refunds creator)
CREATE OR REPLACE FUNCTION public.reject_payment_request(p_link_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_link RECORD;
    v_wallet_id UUID;
BEGIN
    -- Get link and lock
    SELECT * INTO v_link FROM public.secure_links WHERE id = p_link_id AND status = 'pending_approval' FOR UPDATE;
    IF v_link IS NULL THEN RAISE EXCEPTION 'Request not found or not in pending state'; END IF;

    -- Security: Ensure the link belongs to this user
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = auth.uid() LIMIT 1;
    IF v_link.creator_wallet_id != v_wallet_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    -- 1. Refund the creator (Return funds to wallet)
    -- Note: When the link was created, funds were deducted and held by the app logic.
    UPDATE public.wallets 
    SET balance = balance + v_link.requested_amount, 
        updated_at = NOW() 
    WHERE id = v_wallet_id;

    -- 2. Record Refund Transaction
    INSERT INTO public.transactions (wallet_id, amount, type, description, category, reference, status)
    VALUES (v_wallet_id, v_link.requested_amount, 'credit', 'Refund: Declined Request', 'Transfer', 'REF_' || v_link.link_code, 'success');

    -- 3. Mark as rejected
    UPDATE public.secure_links 
    SET status = 'rejected', updated_at = NOW() 
    WHERE id = p_link_id;

    RETURN json_build_object('success', true);
END;
$$;

-- 2. Public function to fetch a link by its code (for LinkView detection)
CREATE OR REPLACE FUNCTION public.get_link_by_code(p_link_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_link RECORD;
BEGIN
    SELECT * INTO v_link 
    FROM public.secure_links 
    WHERE link_code = UPPER(p_link_code) 
    AND status IN ('active', 'pending_approval')
    LIMIT 1;

    IF v_link IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN json_build_object(
        'id', v_link.id,
        'link_code', v_link.link_code,
        'amount', v_link.amount,
        'status', v_link.status,
        'description', v_link.description
    );
END;
$$;
