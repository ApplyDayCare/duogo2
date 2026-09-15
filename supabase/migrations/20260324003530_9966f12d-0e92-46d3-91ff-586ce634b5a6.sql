
-- Update is_match_participant to support couple partners
CREATE OR REPLACE FUNCTION public.is_match_participant(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id
      AND m.status = 'mutual'
      AND (
        -- Direct participant
        m.user_a_id = auth.uid() OR m.user_b_id = auth.uid()
        -- Couple partner of user_a
        OR EXISTS (
          SELECT 1 FROM public.couples c
          WHERE (c.partner_a_id = m.user_a_id OR c.partner_b_id = m.user_a_id)
            AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
        )
        -- Couple partner of user_b
        OR EXISTS (
          SELECT 1 FROM public.couples c
          WHERE (c.partner_a_id = m.user_b_id OR c.partner_b_id = m.user_b_id)
            AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
        )
      )
  );
$$;
