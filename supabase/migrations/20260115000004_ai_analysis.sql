-- Migration: AI spending analysis functions

-- 1. Get spending summary by category for the current month
CREATE OR REPLACE FUNCTION public.get_ai_spending_summary(p_wallet_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total_spending BIGINT;
    v_category_spending JSON;
BEGIN
    -- Get total spending for current month (debit transactions)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_spending
    FROM public.transactions
    WHERE wallet_id = p_wallet_id
      AND type = 'debit'
      AND created_at >= date_trunc('month', now());

    -- Get category-wise breakdown
    SELECT json_agg(t) INTO v_category_spending
    FROM (
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM public.transactions
        WHERE wallet_id = p_wallet_id
          AND type = 'debit'
          AND created_at >= date_trunc('month', now())
        GROUP BY category
    ) t;

    RETURN json_build_object(
        'month', to_char(now(), 'Month YYYY'),
        'total_spending', v_total_spending,
        'breakdown', v_category_spending
    );
END;
$$;

-- 2. Get recent transaction history (more than just 5)
CREATE OR REPLACE FUNCTION public.get_ai_detailed_history(p_wallet_id UUID, p_limit INT DEFAULT 20)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_history JSON;
BEGIN
    SELECT json_agg(t) INTO v_history
    FROM (
        SELECT amount, type, description, category, created_at
        FROM public.transactions
        WHERE wallet_id = p_wallet_id
        ORDER BY created_at DESC
        LIMIT p_limit
    ) t;

    RETURN v_history;
END;
$$;
