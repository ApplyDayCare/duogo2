
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  social_link TEXT,
  user_type TEXT CHECK (user_type IN ('solo', 'couple')),
  location_city TEXT,
  travel_radius_km INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create couples table
CREATE TABLE public.couples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  partner_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_b_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  both_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Couples RLS policies
CREATE POLICY "Members can view their couples"
  ON public.couples FOR SELECT
  USING (auth.uid() = partner_a_id OR auth.uid() = partner_b_id);

CREATE POLICY "Partner A can create couple"
  ON public.couples FOR INSERT
  WITH CHECK (auth.uid() = partner_a_id);

CREATE POLICY "Partner A can update couple"
  ON public.couples FOR UPDATE
  USING (auth.uid() = partner_a_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
