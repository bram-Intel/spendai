-- Create secure_links table for payment links
CREATE TABLE IF NOT EXISTS public.secure_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    passcode_hash TEXT NOT NULL,
    link_code TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'expired', 'cancelled')),
    claimed_by_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_secure_links_link_code ON public.secure_links(link_code);
CREATE INDEX IF NOT EXISTS idx_secure_links_creator ON public.secure_links(creator_wallet_id);
CREATE INDEX IF NOT EXISTS idx_secure_links_status ON public.secure_links(status);

-- Enable RLS
ALTER TABLE public.secure_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own created links
CREATE POLICY "Users can view their own created links"
    ON public.secure_links
    FOR SELECT
    USING (
        creator_wallet_id IN (
            SELECT id FROM public.wallets WHERE user_id = auth.uid()
        )
    );

-- Users can create links from their own wallet
CREATE POLICY "Users can create links from their own wallet"
    ON public.secure_links
    FOR INSERT
    WITH CHECK (
        creator_wallet_id IN (
            SELECT id FROM public.wallets WHERE user_id = auth.uid()
        )
    );

-- Users can update their own links (e.g., cancel)
CREATE POLICY "Users can update their own links"
    ON public.secure_links
    FOR UPDATE
    USING (
        creator_wallet_id IN (
            SELECT id FROM public.wallets WHERE user_id = auth.uid()
        )
    );

-- Function to create a payment link
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

-- Function to claim a payment link
CREATE OR REPLACE FUNCTION public.claim_payment_link(
    p_link_code TEXT,
    p_passcode TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link RECORD;
    v_claimer_wallet_id UUID;
    v_passcode_hash TEXT;
BEGIN
    -- Get user's wallet
    SELECT id INTO v_claimer_wallet_id
    FROM public.wallets
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_claimer_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    -- Get link details
    SELECT * INTO v_link
    FROM public.secure_links
    WHERE link_code = UPPER(p_link_code)
    AND status = 'active'
    AND expires_at > NOW()
    FOR UPDATE;

    IF v_link IS NULL THEN
        RAISE EXCEPTION 'Link not found, already claimed, or expired';
    END IF;

    -- Verify passcode
    v_passcode_hash := MD5(p_passcode || 'salt');
    
    IF v_link.passcode_hash != v_passcode_hash THEN
        RAISE EXCEPTION 'Invalid passcode';
    END IF;

    -- Prevent self-claiming
    IF v_link.creator_wallet_id = v_claimer_wallet_id THEN
        RAISE EXCEPTION 'Cannot claim your own link';
    END IF;

    -- Credit claimer's wallet
    UPDATE public.wallets
    SET balance = balance + v_link.amount,
        updated_at = NOW()
    WHERE id = v_claimer_wallet_id;

    -- Update link status
    UPDATE public.secure_links
    SET status = 'claimed',
        claimed_by_wallet_id = v_claimer_wallet_id,
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_link.id;

    -- Record transaction for claimer
    INSERT INTO public.transactions (
        wallet_id,
        amount,
        type,
        description,
        category,
        reference,
        status
    ) VALUES (
        v_claimer_wallet_id,
        v_link.amount,
        'credit',
        COALESCE(v_link.description, 'Secure Link Claimed'),
        'Transfer',
        'LINK_' || p_link_code,
        'success'
    );

    -- Return success
    RETURN json_build_object(
        'success', true,
        'amount', v_link.amount,
        'message', 'Link claimed successfully'
    );
END;
$$;
