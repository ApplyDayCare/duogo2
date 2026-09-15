
CREATE OR REPLACE FUNCTION public.handle_match_action(_other_user_id uuid, _action text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _ids uuid[];
  _is_user_a boolean;
  _existing record;
  _new_status text;
  _other_action text;
  _match_id uuid;
  _result json;
  _my_name text;
  _other_name text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF _action NOT IN ('accept', 'pass') THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  IF _other_user_id = _user_id THEN
    RAISE EXCEPTION 'Cannot match with yourself';
  END IF;

  IF _user_id < _other_user_id THEN
    _ids := ARRAY[_user_id, _other_user_id];
    _is_user_a := true;
  ELSE
    _ids := ARRAY[_other_user_id, _user_id];
    _is_user_a := false;
  END IF;

  SELECT * INTO _existing
  FROM matches
  WHERE user_a_id = _ids[1] AND user_b_id = _ids[2];

  IF _existing IS NOT NULL THEN
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
    RETURNING id INTO _match_id;
  END IF;

  -- Send in-app notifications for mutual matches
  IF _new_status = 'mutual' THEN
    SELECT COALESCE(first_name, 'Someone') INTO _my_name FROM profiles WHERE id = _user_id;
    SELECT COALESCE(first_name, 'Someone') INTO _other_name FROM profiles WHERE id = _other_user_id;

    INSERT INTO notifications (user_id, message)
    VALUES
      (_user_id, 'It''s a match! 🎉 You and ' || _other_name || ' both accepted. Check your match reveal!'),
      (_other_user_id, 'It''s a match! 🎉 You and ' || _my_name || ' both accepted. Check your match reveal!');
  END IF;

  RETURN json_build_object(
    'match_id', _match_id,
    'status', _new_status
  );
END;
$function$;
