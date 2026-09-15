
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS matching_paused boolean NOT NULL DEFAULT false;
