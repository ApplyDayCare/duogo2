-- Add privacy_consented column to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS privacy_consented BOOLEAN NOT NULL DEFAULT false;
