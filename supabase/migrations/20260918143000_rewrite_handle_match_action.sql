-- Migration: Rewrite public.handle_match_action
-- 1. Orders IDs canonically: user_a_id = LEAST(caller, other), user_b_id = GREATEST(caller, other).
-- 2. Looks up canonical row directly by (user_a_id, user_b_id) with row locking.
-- 3. Writes only the caller's action column (user_a_action or user_b_action).
-- 4. Computes compatibility_score server-side from quiz_responses using 2x weighted anchor dimensions.
-- 5. Derives status from both action columns; enforces closed states ('mutual', 'passed_by_a', 'passed_by_b').
-- 6. Sets revealed_at only on transition into 'mutual' if currently NULL.
-- 7. Idempotent notifications on transition into 'mutual' only.

CREATE OR REPLACE FUNCTION public.handle_match_action(_other_user_id uuid, _action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _canonical_a uuid;
  _canonical_b uuid;
  _caller_is_a boolean;

  _existing record;
  _match_id uuid;
  _new_status text;
  _new_revealed_at timestamptz;
  _new_user_a_action text;
  _new_user_b_action text;
  _is_transition_to_mutual boolean := false;

  _quiz_a record;
  _quiz_b record;
  _score numeric := 75.0;

  _caller_name text;
  _other_name text;
  _partner_id uuid;
  _other_partner_id uuid;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _action NOT IN ('accept', 'pass') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  IF _other_user_id IS NULL OR _other_user_id = _caller_id THEN
    RAISE EXCEPTION 'Cannot match with yourself';
  END IF;

  -- 1. Canonical UUID ordering: smaller is user_a_id, larger is user_b_id
  IF _caller_id < _other_user_id THEN
    _canonical_a := _caller_id;
    _canonical_b := _other_user_id;
    _caller_is_a := true;
  ELSE
    _canonical_a := _other_user_id;
    _canonical_b := _caller_id;
    _caller_is_a := false;
  END IF;

  -- 2. Compute compatibility score server-side from quiz_responses
  -- Dimensions: 1..10, with 2x weight on anchor dimensions [2 (budget), 7 (alcohol), 9 (commitment), 10 (home)]
  -- maxDist = sqrt(224); score = 100 - (distance / sqrt(224)) * 100, rounded to 1 decimal place
  SELECT * INTO _quiz_a FROM public.quiz_responses WHERE user_id = _canonical_a LIMIT 1;
  SELECT * INTO _quiz_b FROM public.quiz_responses WHERE user_id = _canonical_b LIMIT 1;

  IF _quiz_a.id IS NOT NULL AND _quiz_b.id IS NOT NULL THEN
    _score := ROUND(
      (100.0 - (
        SQRT(
            1.0 * POWER(COALESCE(_quiz_a.dimension_1_social, 3) - COALESCE(_quiz_b.dimension_1_social, 3), 2)
          + 2.0 * POWER(COALESCE(_quiz_a.dimension_2_budget, 3) - COALESCE(_quiz_b.dimension_2_budget, 3), 2)
          + 1.0 * POWER(COALESCE(_quiz_a.dimension_3_spontaneity, 3) - COALESCE(_quiz_b.dimension_3_spontaneity, 3), 2)
          + 1.0 * POWER(COALESCE(_quiz_a.dimension_4_planning, 3) - COALESCE(_quiz_b.dimension_4_planning, 3), 2)
          + 1.0 * POWER(COALESCE(_quiz_a.dimension_5_intellectual, 3) - COALESCE(_quiz_b.dimension_5_intellectual, 3), 2)
          + 1.0 * POWER(COALESCE(_quiz_a.dimension_6_activity, 3) - COALESCE(_quiz_b.dimension_6_activity, 3), 2)
          + 2.0 * POWER(COALESCE(_quiz_a.dimension_7_alcohol, 3) - COALESCE(_quiz_b.dimension_7_alcohol, 3), 2)
          + 1.0 * POWER(COALESCE(_quiz_a.dimension_8_humor, 3) - COALESCE(_quiz_b.dimension_8_humor, 3), 2)
          + 2.0 * POWER(COALESCE(_quiz_a.dimension_9_commitment, 3) - COALESCE(_quiz_b.dimension_9_commitment, 3), 2)
          + 2.0 * POWER(COALESCE(_quiz_a.dimension_10_home, 3) - COALESCE(_quiz_b.dimension_10_home, 3), 2)
        ) / SQRT(224.0)
      ) * 100.0)::numeric,
      1
    );
  END IF;

  -- 3. Look up single canonical row directly by (user_a_id, user_b_id) with row-level locking
  SELECT * INTO _existing
  FROM public.matches
  WHERE user_a_id = _canonical_a AND user_b_id = _canonical_b
  FOR UPDATE;

  -- 4. If row does not exist yet, create it with caller's action and other side NULL
  IF _existing.id IS NULL THEN
    _new_user_a_action := CASE WHEN _caller_is_a THEN _action ELSE NULL END;
    _new_user_b_action := CASE WHEN NOT _caller_is_a THEN _action ELSE NULL END;

    IF _action = 'pass' THEN
      _new_status := CASE WHEN _caller_is_a THEN 'passed_by_a' ELSE 'passed_by_b' END;
    ELSE
      _new_status := 'pending';
    END IF;

    INSERT INTO public.matches (
      user_a_id,
      user_b_id,
      compatibility_score,
      status,
      user_a_action,
      user_b_action,
      revealed_at
    ) VALUES (
      _canonical_a,
      _canonical_b,
      COALESCE(_score, 75.0),
      _new_status,
      _new_user_a_action,
      _new_user_b_action,
      NULL
    )
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING
    RETURNING id, status INTO _match_id, _new_status;

    -- If concurrent insert succeeded right before our insert, re-fetch and fall through to existing-row handling
    IF _match_id IS NOT NULL THEN
      RETURN json_build_object(
        'match_id', _match_id,
        'status', _new_status
      );
    ELSE
      SELECT * INTO _existing
      FROM public.matches
      WHERE user_a_id = _canonical_a AND user_b_id = _canonical_b
      FOR UPDATE;
    END IF;
  END IF;

  -- 5. Existing row handling with state transition guards
  IF _existing.status = 'mutual' THEN
    -- Match is already mutual: row is closed. Do not change status, ordering, or revealed_at.
    -- Update caller's own action column only.
    UPDATE public.matches
    SET
      user_a_action = CASE WHEN _caller_is_a THEN _action ELSE user_a_action END,
      user_b_action = CASE WHEN NOT _caller_is_a THEN _action ELSE user_b_action END
    WHERE id = _existing.id;

    _match_id := _existing.id;
    _new_status := 'mutual';

  ELSIF _existing.status IN ('passed_by_a', 'passed_by_b') THEN
    -- Match has already been passed: row is closed to future accepts.
    -- Update caller's own action column only for record-keeping.
    UPDATE public.matches
    SET
      user_a_action = CASE WHEN _caller_is_a THEN _action ELSE user_a_action END,
      user_b_action = CASE WHEN NOT _caller_is_a THEN _action ELSE user_b_action END
    WHERE id = _existing.id;

    _match_id := _existing.id;
    _new_status := _existing.status;

  ELSE
    -- Row is open (e.g. 'pending').
    -- Write only the caller's action column:
    _new_user_a_action := CASE WHEN _caller_is_a THEN _action ELSE _existing.user_a_action END;
    _new_user_b_action := CASE WHEN NOT _caller_is_a THEN _action ELSE _existing.user_b_action END;

    -- Derive status from both action columns:
    IF _new_user_a_action = 'accept' AND _new_user_b_action = 'accept' THEN
      _new_status := 'mutual';
    ELSIF _new_user_a_action = 'pass' OR _new_user_b_action = 'pass' THEN
      IF _new_user_a_action = 'pass' AND _new_user_b_action = 'pass' THEN
        -- Both passed: keep whichever happened first
        IF _existing.user_a_action = 'pass' THEN
          _new_status := 'passed_by_a';
        ELSIF _existing.user_b_action = 'pass' THEN
          _new_status := 'passed_by_b';
        ELSIF _caller_is_a THEN
          _new_status := 'passed_by_a';
        ELSE
          _new_status := 'passed_by_b';
        END IF;
      ELSIF _new_user_a_action = 'pass' THEN
        _new_status := 'passed_by_a';
      ELSE
        _new_status := 'passed_by_b';
      END IF;
    ELSIF (_new_user_a_action = 'accept' AND _new_user_b_action IS NULL)
       OR (_new_user_b_action = 'accept' AND _new_user_a_action IS NULL) THEN
      _new_status := 'pending';
    ELSE
      _new_status := COALESCE(_existing.status, 'pending');
    END IF;

    -- Set revealed_at only on the transition into 'mutual', and only if currently null
    _is_transition_to_mutual := (_new_status = 'mutual' AND _existing.status <> 'mutual');
    IF _is_transition_to_mutual THEN
      _new_revealed_at := COALESCE(_existing.revealed_at, now());
    ELSE
      _new_revealed_at := _existing.revealed_at;
    END IF;

    UPDATE public.matches
    SET
      user_a_action = _new_user_a_action,
      user_b_action = _new_user_b_action,
      status = _new_status,
      revealed_at = _new_revealed_at,
      compatibility_score = CASE
        WHEN matches.compatibility_score IS NULL OR matches.compatibility_score = 0 THEN COALESCE(_score, matches.compatibility_score, 75.0)
        ELSE matches.compatibility_score
      END
    WHERE id = _existing.id;

    _match_id := _existing.id;
  END IF;

  -- 6. Notifications: specifically and only on transition into 'mutual'
  IF _is_transition_to_mutual THEN
    SELECT COALESCE(first_name, 'Someone') INTO _caller_name FROM public.profiles WHERE id = _caller_id;
    SELECT COALESCE(first_name, 'Someone') INTO _other_name FROM public.profiles WHERE id = _other_user_id;

    -- Insert notification for caller if not already present
    INSERT INTO public.notifications (user_id, message, link)
    SELECT _caller_id, 'It''s a match! 🎉 You and ' || _other_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE user_id = _caller_id AND link = '/match-reveal/' || _match_id::text
    );

    -- Insert notification for other user if not already present
    INSERT INTO public.notifications (user_id, message, link)
    SELECT _other_user_id, 'It''s a match! 🎉 You and ' || _caller_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications WHERE user_id = _other_user_id AND link = '/match-reveal/' || _match_id::text
    );

    -- Check for couple partners to notify as well
    SELECT CASE
      WHEN c.partner_a_id = _caller_id THEN c.partner_b_id
      ELSE c.partner_a_id
    END INTO _partner_id
    FROM public.couples c
    WHERE (c.partner_a_id = _caller_id OR c.partner_b_id = _caller_id)
      AND c.partner_b_id IS NOT NULL
    LIMIT 1;

    IF _partner_id IS NOT NULL AND _partner_id <> _caller_id THEN
      INSERT INTO public.notifications (user_id, message, link)
      SELECT _partner_id, 'It''s a match! 🎉 You and ' || _other_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications WHERE user_id = _partner_id AND link = '/match-reveal/' || _match_id::text
      );
    END IF;

    SELECT CASE
      WHEN c.partner_a_id = _other_user_id THEN c.partner_b_id
      ELSE c.partner_a_id
    END INTO _other_partner_id
    FROM public.couples c
    WHERE (c.partner_a_id = _other_user_id OR c.partner_b_id = _other_user_id)
      AND c.partner_b_id IS NOT NULL
    LIMIT 1;

    IF _other_partner_id IS NOT NULL AND _other_partner_id <> _other_user_id THEN
      INSERT INTO public.notifications (user_id, message, link)
      SELECT _other_partner_id, 'It''s a match! 🎉 You and ' || _caller_name || ' both accepted. Check your match reveal!', '/match-reveal/' || _match_id::text
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications WHERE user_id = _other_partner_id AND link = '/match-reveal/' || _match_id::text
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'match_id', _match_id,
    'status', _new_status
  );
END;
$function$;
