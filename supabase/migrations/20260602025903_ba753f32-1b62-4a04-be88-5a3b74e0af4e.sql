-- Clear invite_code once partner_b joins (and the row is updated with partner_b_id),
-- so the one-time invite secret can no longer be read or reused.
CREATE OR REPLACE FUNCTION public.clear_used_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.partner_b_id IS NOT NULL THEN
    NEW.invite_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_used_invite_code ON public.couples;
CREATE TRIGGER trg_clear_used_invite_code
BEFORE INSERT OR UPDATE ON public.couples
FOR EACH ROW
EXECUTE FUNCTION public.clear_used_invite_code();

-- One-time cleanup of existing rows where partner_b already joined but invite_code is still present
UPDATE public.couples
SET invite_code = NULL
WHERE partner_b_id IS NOT NULL AND invite_code IS NOT NULL;