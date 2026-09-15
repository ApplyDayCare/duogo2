
-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create profile-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view (public bucket)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- RLS: authenticated users can upload their own photo
CREATE POLICY "Users can upload own photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can update (overwrite) their own photo
CREATE POLICY "Users can update own photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can delete their own photo
CREATE POLICY "Users can delete own photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
