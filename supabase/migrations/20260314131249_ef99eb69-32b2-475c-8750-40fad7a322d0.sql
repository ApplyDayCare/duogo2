
CREATE OR REPLACE FUNCTION public.block_match_user(_other_user_id uuid, _match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert block record
  INSERT INTO blocks (blocker_id, blocked_user_id)
  VALUES (_user_id, _other_user_id);

  -- Update match status to blocked if match_id provided and valid
  IF _match_id IS NOT NULL AND _match_id != '00000000-0000-0000-0000-000000000000'::uuid THEN
    UPDATE matches SET status = 'blocked'
    WHERE id = _match_id
      AND (user_a_id = _user_id OR user_b_id = _user_id);
  END IF;
END;
$$;
