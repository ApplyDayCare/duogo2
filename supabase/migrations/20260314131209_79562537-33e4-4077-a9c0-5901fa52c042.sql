
-- 1. Drop the permissive INSERT policy on matches
DROP POLICY IF EXISTS "Users can insert matches" ON public.matches;

-- 2. Restrict the UPDATE policy: users can only update their own action column,
--    and cannot modify system-managed fields (compatibility_score, status, revealed_at, user_a_id, user_b_id)
DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;

CREATE POLICY "Users can update own match action"
ON public.matches FOR UPDATE TO authenticated
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
WITH CHECK (
  (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  -- Prevent changing the other user's action
  AND (
    CASE WHEN auth.uid() = user_a_id
      THEN user_b_action IS NOT DISTINCT FROM (SELECT m.user_b_action FROM public.matches m WHERE m.id = matches.id)
      ELSE user_a_action IS NOT DISTINCT FROM (SELECT m.user_a_action FROM public.matches m WHERE m.id = matches.id)
    END
  )
  -- Protect system-managed fields
  AND compatibility_score = (SELECT m.compatibility_score FROM public.matches m WHERE m.id = matches.id)
  AND revealed_at IS NOT DISTINCT FROM (SELECT m.revealed_at FROM public.matches m WHERE m.id = matches.id)
  AND status = (SELECT m.status FROM public.matches m WHERE m.id = matches.id)
  AND user_a_id = (SELECT m.user_a_id FROM public.matches m WHERE m.id = matches.id)
  AND user_b_id = (SELECT m.user_b_id FROM public.matches m WHERE m.id = matches.id)
);

-- 3. Create SECURITY DEFINER function to handle match actions
CREATE OR REPLACE FUNCTION public.handle_match_action(_other_user_id uuid, _action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _ids uuid[];
  _is_user_a boolean;
  _existing record;
  _new_status text;
  _other_action text;
  _match_id uuid;
  _result json;
BEGIN
  -- Validate inputs
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF _action NOT IN ('accept', 'pass') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  IF _other_user_id = _user_id THEN
    RAISE EXCEPTION 'Cannot match with yourself';
  END IF;

  -- Determine alphabetical ordering for consistency
  IF _user_id < _other_user_id THEN
    _ids := ARRAY[_user_id, _other_user_id];
    _is_user_a := true;
  ELSE
    _ids := ARRAY[_other_user_id, _user_id];
    _is_user_a := false;
  END IF;

  -- Check for existing match
  SELECT * INTO _existing
  FROM matches
  WHERE user_a_id = _ids[1] AND user_b_id = _ids[2];

  IF _existing IS NOT NULL THEN
    -- Determine new status
    IF _action = 'pass' THEN
      _new_status := CASE WHEN _is_user_a THEN 'passed_by_a' ELSE 'passed_by_b' END;
    ELSE
      _other_action := CASE WHEN _is_user_a THEN _existing.user_b_action ELSE _existing.user_a_action END;
      IF _other_action = 'accept' THEN
        _new_status := 'mutual';
      ELSE
        _new_status := 'pending';
      END IF;
    END IF;

    -- Update existing match
    IF _is_user_a THEN
      UPDATE matches SET
        user_a_action = _action,
        status = _new_status,
        revealed_at = CASE WHEN _new_status = 'mutual' THEN now() ELSE revealed_at END
      WHERE id = _existing.id;
    ELSE
      UPDATE matches SET
        user_b_action = _action,
        status = _new_status,
        revealed_at = CASE WHEN _new_status = 'mutual' THEN now() ELSE revealed_at END
      WHERE id = _existing.id;
    END IF;

    _match_id := _existing.id;
  ELSE
    -- Create new match (only the server function can do this now)
    _new_status := CASE
      WHEN _action = 'pass' THEN
        CASE WHEN _is_user_a THEN 'passed_by_a' ELSE 'passed_by_b' END
      ELSE 'pending'
    END;

    INSERT INTO matches (user_a_id, user_b_id, compatibility_score, status, user_a_action, user_b_action)
    VALUES (
      _ids[1], _ids[2], 0, _new_status,
      CASE WHEN _is_user_a THEN _action ELSE NULL END,
      CASE WHEN _is_user_a THEN NULL ELSE _action END
    )
    RETURNING id INTO _match_id;
  END IF;

  RETURN json_build_object(
    'match_id', _match_id,
    'status', _new_status
  );
END;
$$;
