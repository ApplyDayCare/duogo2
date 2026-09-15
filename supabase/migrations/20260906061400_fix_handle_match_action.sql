-- Fix handle_match_action duplicate key constraint bug
-- PostgreSQL's `record IS NOT NULL` evaluates to FALSE when any column is NULL (e.g. user_b_action, revealed_at).
-- Using `IF FOUND THEN` (or `_existing.id IS NOT NULL`) ensures existing match records are properly updated.

CREATE OR REPLACE FUNCTION public.handle_match_action(_other_user_id uuid, _action text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _actor_id uuid;
  _partner_id uuid;
  _other_partner_id uuid;
  _ids uuid[];
  _is_user_a boolean;
  _existing record;
  _new_status text;
  _other_action text;
  _match_id uuid;
  _my_name text;
  _other_name text;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _action NOT IN ('accept', 'pass') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  IF _other_user_id = _caller_id THEN
    RAISE EXCEPTION 'Cannot match with yourself';
  END IF;

  -- Find caller's couple partner (if any)
  SELECT CASE
    WHEN c.partner_a_id = _caller_id THEN c.partner_b_id
    ELSE c.partner_a_id
  END
  INTO _partner_id
  FROM public.couples c
  WHERE c.partner_a_id = _caller_id OR c.partner_b_id = _caller_id
  LIMIT 1;

  IF _partner_id = _caller_id THEN
    _partner_id := NULL;
  END IF;

  -- Default: caller is the actor on the match record
  _actor_id := _caller_id;

  -- If caller is not in any existing match with _other_user_id but their partner is,
  -- act on behalf of the partner (the actual match participant)
  IF _partner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE (m.user_a_id = _caller_id AND m.user_b_id = _other_user_id)
         OR (m.user_a_id = _other_user_id AND m.user_b_id = _caller_id)
    ) AND EXISTS (
      SELECT 1 FROM matches m
      WHERE (m.user_a_id = _partner_id AND m.user_b_id = _other_user_id)
         OR (m.user_a_id = _other_user_id AND m.user_b_id = _partner_id)
    ) THEN
      _actor_id := _partner_id;
    END IF;
  END IF;

  IF _actor_id < _other_user_id THEN
    _ids := ARRAY[_actor_id, _other_user_id];
    _is_user_a := true;
  ELSE
    _ids := ARRAY[_other_user_id, _actor_id];
    _is_user_a := false;
  END IF;

  SELECT * INTO _existing
  FROM matches
  WHERE user_a_id = _ids[1] AND user_b_id = _ids[2];

  -- CRITICAL FIX: Use FOUND or _existing.id IS NOT NULL instead of _existing IS NOT NULL
  IF FOUND AND _existing.id IS NOT NULL THEN
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
    ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
      user_a_action = CASE WHEN _is_user_a THEN EXCLUDED.user_a_action ELSE matches.user_a_action END,
      user_b_action = CASE WHEN NOT _is_user_a THEN EXCLUDED.user_b_action ELSE matches.user_b_action END,
      status = CASE 
        WHEN (_is_user_a AND matches.user_b_action = 'accept') OR (NOT _is_user_a AND matches.user_a_action = 'accept') THEN 'mutual'
        ELSE matches.status
      END,
      revealed_at = CASE 
        WHEN (_is_user_a AND matches.user_b_action = 'accept') OR (NOT _is_user_a AND matches.user_a_action = 'accept') THEN now()
        ELSE matches.revealed_at
      END
    RETURNING id, status INTO _match_id, _new_status;
  END IF;

  -- Notify all involved parties when mutual
  IF _new_status = 'mutual' THEN
    SELECT COALESCE(first_name, 'Someone') INTO _my_name FROM profiles WHERE id = _actor_id;
    SELECT COALESCE(first_name, 'Someone') INTO _other_name FROM profiles WHERE id = _other_user_id;

    -- Find other side's couple partner (if any) so they're notified too
    SELECT CASE
      WHEN c.partner_a_id = _other_user_id THEN c.partner_b_id
      ELSE c.partner_a_id
    END
    INTO _other_partner_id
    FROM public.couples c
    WHERE c.partner_a_id = _other_user_id OR c.partner_b_id = _other_user_id
    LIMIT 1;

    INSERT INTO notifications (user_id, message, link)
    VALUES
      (_actor_id, 'It''s a match! 🎉 You and ' || _other_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text),
      (_other_user_id, 'It''s a match! 🎉 You and ' || _my_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text);

    IF _partner_id IS NOT NULL AND _partner_id <> _actor_id THEN
      INSERT INTO notifications (user_id, message, link)
      VALUES (_partner_id, 'It''s a match! 🎉 You and ' || _other_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text);
    END IF;

    IF _other_partner_id IS NOT NULL AND _other_partner_id <> _other_user_id THEN
      INSERT INTO notifications (user_id, message, link)
      VALUES (_other_partner_id, 'It''s a match! 🎉 You and ' || _my_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text);
    END IF;
  END IF;

  RETURN json_build_object(
    'match_id', _match_id,
    'status', _new_status
  );
END;
$function$;
