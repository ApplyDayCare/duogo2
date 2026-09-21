-- Migration: Canonicalize public.matches
-- 1. Merges reversed duplicate pairs (A,B) and (B,A), keeping the older row, combining actions/scores/status, re-pointing foreign keys, and deleting the newer row.
-- 2. Normalizes remaining rows so user_a_id < user_b_id (swapping user_a/b_id and user_a/b_action).
-- 3. Adds CHECK constraint matches_canonical_order (user_a_id < user_b_id).

DO $$
DECLARE
  v_pair RECORD;
  v_merged_count INTEGER := 0;
  v_swapped_count INTEGER := 0;
  v_kept_id UUID;
  v_deleted_id UUID;
  v_kept_user_a UUID;
  v_kept_user_b UUID;
  v_kept_action_a TEXT;
  v_kept_action_b TEXT;
  v_del_action_a TEXT;
  v_del_action_b TEXT;
  v_final_action_a TEXT;
  v_final_action_b TEXT;
  v_final_score NUMERIC;
  v_final_status TEXT;
  v_final_revealed_at TIMESTAMPTZ;
BEGIN
  -- -------------------------------------------------------------------------
  -- STEP 1: Merge reversed duplicate rows
  -- -------------------------------------------------------------------------
  FOR v_pair IN
    WITH ranked_pairs AS (
      SELECT
        m1.id AS id_1,
        m1.user_a_id AS u1_a,
        m1.user_b_id AS u1_b,
        m1.user_a_action AS act1_a,
        m1.user_b_action AS act1_b,
        m1.compatibility_score AS score_1,
        m1.status AS status_1,
        m1.revealed_at AS rev_1,
        m1.created_at AS created_1,
        m2.id AS id_2,
        m2.user_a_id AS u2_a,
        m2.user_b_id AS u2_b,
        m2.user_a_action AS act2_a,
        m2.user_b_action AS act2_b,
        m2.compatibility_score AS score_2,
        m2.status AS status_2,
        m2.revealed_at AS rev_2,
        m2.created_at AS created_2
      FROM public.matches m1
      JOIN public.matches m2
        ON m1.user_a_id = m2.user_b_id
       AND m1.user_b_id = m2.user_a_id
       AND m1.id < m2.id -- avoid visiting symmetric pairs twice
    )
    SELECT * FROM ranked_pairs
  LOOP
    -- Decide which row to keep based on earlier created_at (tiebreak on id)
    IF v_pair.created_1 <= v_pair.created_2 THEN
      v_kept_id := v_pair.id_1;
      v_kept_user_a := v_pair.u1_a;
      v_kept_user_b := v_pair.u1_b;
      v_kept_action_a := v_pair.act1_a;
      v_kept_action_b := v_pair.act1_b;

      v_deleted_id := v_pair.id_2;
      -- On row 2: u2_a is u1_b (kept user B), and u2_b is u1_a (kept user A)
      v_del_action_a := v_pair.act2_a; -- action by u1_b
      v_del_action_b := v_pair.act2_b; -- action by u1_a

      v_final_action_a := COALESCE(v_kept_action_a, v_del_action_b);
      v_final_action_b := COALESCE(v_kept_action_b, v_del_action_a);
      v_final_score := GREATEST(v_pair.score_1, v_pair.score_2);
      v_final_status := CASE WHEN v_pair.status_1 = 'mutual' OR v_pair.status_2 = 'mutual' THEN 'mutual' ELSE v_pair.status_1 END;
      v_final_revealed_at := COALESCE(v_pair.rev_1, v_pair.rev_2);
    ELSE
      v_kept_id := v_pair.id_2;
      v_kept_user_a := v_pair.u2_a;
      v_kept_user_b := v_pair.u2_b;
      v_kept_action_a := v_pair.act2_a;
      v_kept_action_b := v_pair.act2_b;

      v_deleted_id := v_pair.id_1;
      -- On row 1: u1_a is u2_b (kept user B), and u1_b is u2_a (kept user A)
      v_del_action_a := v_pair.act1_a; -- action by u2_b
      v_del_action_b := v_pair.act1_b; -- action by u2_a

      v_final_action_a := COALESCE(v_kept_action_a, v_del_action_b);
      v_final_action_b := COALESCE(v_kept_action_b, v_del_action_a);
      v_final_score := GREATEST(v_pair.score_1, v_pair.score_2);
      v_final_status := CASE WHEN v_pair.status_1 = 'mutual' OR v_pair.status_2 = 'mutual' THEN 'mutual' ELSE v_pair.status_2 END;
      v_final_revealed_at := COALESCE(v_pair.rev_2, v_pair.rev_1);
    END IF;

    -- Update the kept row with merged attributes
    UPDATE public.matches
    SET
      user_a_action = v_final_action_a,
      user_b_action = v_final_action_b,
      compatibility_score = v_final_score,
      status = v_final_status,
      revealed_at = v_final_revealed_at
    WHERE id = v_kept_id;

    -- Re-link messages to the kept match
    UPDATE public.messages
    SET match_id = v_kept_id
    WHERE match_id = v_deleted_id;

    -- Re-link reports to the kept match
    UPDATE public.reports
    SET match_id = v_kept_id
    WHERE match_id = v_deleted_id;

    -- Re-link pulse_feedback (delete conflict if kept row already has feedback for that user)
    DELETE FROM public.pulse_feedback
    WHERE match_id = v_deleted_id
      AND user_id IN (SELECT user_id FROM public.pulse_feedback WHERE match_id = v_kept_id);

    UPDATE public.pulse_feedback
    SET match_id = v_kept_id
    WHERE match_id = v_deleted_id;

    -- Delete the duplicate match row
    DELETE FROM public.matches WHERE id = v_deleted_id;

    v_merged_count := v_merged_count + 1;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- STEP 2: Normalize remaining rows so user_a_id < user_b_id
  -- -------------------------------------------------------------------------
  WITH swapped AS (
    UPDATE public.matches
    SET
      user_a_id = user_b_id,
      user_b_id = user_a_id,
      user_a_action = user_b_action,
      user_b_action = user_a_action
    WHERE user_a_id > user_b_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_swapped_count FROM swapped;

  -- -------------------------------------------------------------------------
  -- STEP 3: Add canonical ordering constraint
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_canonical_order'
  ) THEN
    ALTER TABLE public.matches
    ADD CONSTRAINT matches_canonical_order CHECK (user_a_id < user_b_id);
  END IF;

  RAISE NOTICE 'Canonicalize matches completed: merged % reversed-duplicate pair(s), swapped % row(s) to enforce user_a_id < user_b_id.', v_merged_count, v_swapped_count;
END $$;
