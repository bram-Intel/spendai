
-- Create payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID REFERENCES profiles(id) NOT NULL,
    amount BIGINT NOT NULL, -- in kobo
    description TEXT,
    code TEXT UNIQUE NOT NULL, -- Short code for claiming
    status TEXT CHECK (status IN ('active', 'claimed', 'cancelled')) DEFAULT 'active',
    recipient_id UUID REFERENCES profiles(id), -- Null until claimed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for payment_links
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view their own links" ON payment_links
    FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Recipients can view links they claimed" ON payment_links
    FOR SELECT USING (auth.uid() = recipient_id);

-- RPC: Create Payment Link
CREATE OR REPLACE FUNCTION create_payment_link(
    amount BIGINT,
    description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID;
    user_wallet_id UUID;
    user_balance BIGINT;
    link_code TEXT;
    link_id UUID;
BEGIN
    user_id := auth.uid();
    
    -- Generate a simple 8-char random code
    link_code := substring(md5(random()::text) from 1 for 8);

    -- Get Wallet and Lock Row for Update
    SELECT id, balance INTO user_wallet_id, user_balance
    FROM wallets
    WHERE filters.user_id = auth.uid()
    FOR UPDATE;

    IF user_balance < amount THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- Deduct Balance
    UPDATE wallets
    SET balance = balance - amount,
        updated_at = NOW()
    WHERE id = user_wallet_id;

    -- Record Debit Transaction
    INSERT INTO transactions (wallet_id, amount, type, description, category, status)
    VALUES (user_wallet_id, amount, 'debit', 'Created Payment Link: ' || description, 'transfer', 'success');

    -- Create Link Record
    INSERT INTO payment_links (creator_id, amount, description, code, status)
    VALUES (user_id, amount, description, link_code, 'active')
    RETURNING id INTO link_id;

    RETURN json_build_object(
        'success', true,
        'link_code', link_code,
        'link_id', link_id
    );
END;
$$;

-- RPC: Claim Payment Link
CREATE OR REPLACE FUNCTION claim_payment_link(
    link_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    claimer_id UUID;
    claimer_wallet_id UUID;
    link_record RECORD;
BEGIN
    claimer_id := auth.uid();

    -- Find Link
    SELECT * INTO link_record
    FROM payment_links
    WHERE code = link_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Link not found';
    END IF;

    IF link_record.status != 'active' THEN
        RAISE EXCEPTION 'Link already claimed or cancelled';
    END IF;

    IF link_record.creator_id = claimer_id THEN
         -- Optional: Allow creator to cancel/reclaim? For now, prevent self-claim if desired, or allow.
         -- Let's allow self-claim as a way to "cancel" back to wallet.
         -- Or block: RAISE EXCEPTION 'Cannot claim your own link';
    END IF;

    -- Get Claimer Wallet
    SELECT id INTO claimer_wallet_id
    FROM wallets
    WHERE user_id = claimer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claimer wallet not found';
    END IF;

    -- Update Link Status
    UPDATE payment_links
    SET status = 'claimed',
        recipient_id = claimer_id,
        updated_at = NOW()
    WHERE id = link_record.id;

    -- Credit Claimer Wallet
    UPDATE wallets
    SET balance = balance + link_record.amount,
        updated_at = NOW()
    WHERE id = claimer_wallet_id;

    -- Record Credit Transaction
    INSERT INTO transactions (wallet_id, amount, type, description, category, status)
    VALUES (claimer_wallet_id, link_record.amount, 'credit', 'Claimed Link: ' || link_record.description, 'transfer', 'success');

    RETURN json_build_object(
        'success', true,
        'amount', link_record.amount
    );
END;
$$;
