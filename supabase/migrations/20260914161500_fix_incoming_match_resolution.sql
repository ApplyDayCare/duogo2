-- Fix handle_match_action bidirectional lookup and incoming match resolution
-- Ensures that clicking 'Connect Back' on an incoming request always finds the existing match row
-- regardless of UUID column ordering (user_a_id vs user_b_id) and transitions status to 'mutual'.

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
  _existing record;
  _new_status text;
  _other_action text;
  _match_id uuid;
  _my_name text;
  _other_name text;
  _is_user_a boolean;
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

  -- Check if other user has a couple partner
  SELECT CASE
    WHEN c.partner_a_id = _other_user_id THEN c.partner_b_id
    ELSE c.partner_a_id
  END
  INTO _other_partner_id
  FROM public.couples c
  WHERE c.partner_a_id = _other_user_id OR c.partner_b_id = _other_user_id
  LIMIT 1;

  IF _other_partner_id = _other_user_id THEN
    _other_partner_id := NULL;
  END IF;

  -- BIDIRECTIONAL SEARCH:
  -- Find existing match row regardless of whether actor is user_a or user_b,
  -- or if either party is represented by their couple partner.
  SELECT * INTO _existing
  FROM matches
  WHERE ((user_a_id = _actor_id AND user_b_id = _other_user_id)
      OR (user_a_id = _other_user_id AND user_b_id = _actor_id)
      OR (_partner_id IS NOT NULL AND (
          (user_a_id = _partner_id AND user_b_id = _other_user_id)
       OR (user_a_id = _other_user_id AND user_b_id = _partner_id)
      ))
      OR (_other_partner_id IS NOT NULL AND (
          (user_a_id = _actor_id AND user_b_id = _other_partner_id)
       OR (user_a_id = _other_partner_id AND user_b_id = _actor_id)
      )))
  ORDER BY created_at DESC
  LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    -- Match exists! Determine whether _actor_id is user_a or user_b on THIS specific database row
    _is_user_a := (_existing.user_a_id = _actor_id OR (_partner_id IS NOT NULL AND _existing.user_a_id = _partner_id));

    IF _action = 'pass' THEN
      _new_status := CASE WHEN _is_user_a THEN 'passed_by_a' ELSE 'passed_by_b' END;
    ELSE
      -- Connecting back / accept: check other party's action
      _other_action := CASE WHEN _is_user_a THEN _existing.user_b_action ELSE _existing.user_a_action END;
      IF _other_action = 'accept' THEN
        _new_status := 'mutual';
      ELSE
        _new_status := 'pending';
      END IF;
    END IF;

    UPDATE matches SET
      user_a_action = CASE WHEN _is_user_a THEN _action ELSE user_a_action END,
      user_b_action = CASE WHEN NOT _is_user_a THEN _action ELSE user_b_action END,
      status = _new_status,
      revealed_at = CASE WHEN _new_status = 'mutual' THEN now() ELSE revealed_at END
    WHERE id = _existing.id;

    _match_id := _existing.id;
  ELSE
    -- Brand new match: canonical alphabetical ordering for new inserts
    DECLARE
      _first_id uuid;
      _second_id uuid;
    BEGIN
      IF _actor_id < _other_user_id THEN
        _first_id := _actor_id;
        _second_id := _other_user_id;
        _is_user_a := true;
      ELSE
        _first_id := _other_user_id;
        _second_id := _actor_id;
        _is_user_a := false;
      END IF;

      _new_status := CASE
        WHEN _action = 'pass' THEN
          CASE WHEN _is_user_a THEN 'passed_by_a' ELSE 'passed_by_b' END
        ELSE 'pending'
      END;

      INSERT INTO matches (user_a_id, user_b_id, compatibility_score, status, user_a_action, user_b_action)
      VALUES (
        _first_id, _second_id, 0, _new_status,
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
    END;
  END IF;

  -- Notifications when mutual
  IF _new_status = 'mutual' THEN
    SELECT COALESCE(first_name, 'Someone') INTO _my_name FROM profiles WHERE id = _actor_id;
    SELECT COALESCE(first_name, 'Someone') INTO _other_name FROM profiles WHERE id = _other_user_id;

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
