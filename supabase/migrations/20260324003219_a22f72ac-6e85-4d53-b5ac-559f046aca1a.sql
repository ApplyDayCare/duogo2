
-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is participant of a mutual match
CREATE OR REPLACE FUNCTION public.is_match_participant(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = _match_id
      AND status = 'mutual'
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
  );
$$;

-- SELECT: participants of mutual match can read messages
CREATE POLICY "Match participants can read messages"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_match_participant(match_id));

-- INSERT: participants of mutual match can send messages
CREATE POLICY "Match participants can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_match_participant(match_id)
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
