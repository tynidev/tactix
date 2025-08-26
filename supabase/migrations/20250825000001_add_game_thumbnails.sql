-- Add thumbnail columns to games table
ALTER TABLE public.games 
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN thumbnail_file_path TEXT;

-- Create indexes for the new columns
CREATE INDEX idx_games_thumbnail_url ON public.games(thumbnail_url);
CREATE INDEX idx_games_thumbnail_file_path ON public.games(thumbnail_file_path);

-- Create storage bucket for game thumbnails
INSERT INTO storage.buckets (id, name, public) 
VALUES ('game-thumbnails', 'game-thumbnails', true);

-- Set up RLS policy for game thumbnails bucket
-- Allow coaches and admins to upload thumbnail files
CREATE POLICY "Coaches can upload thumbnails" ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'game-thumbnails' 
  AND EXISTS (
    SELECT 1 FROM team_memberships tm
    JOIN user_profiles up ON tm.user_id = up.id
    WHERE up.id = auth.uid()
    AND tm.role IN ('coach', 'admin')
  )
);

-- Allow anyone in the team to read/download thumbnail files
CREATE POLICY "Team members can read thumbnails" ON storage.objects
FOR SELECT 
USING (
  bucket_id = 'game-thumbnails'
  AND EXISTS (
    SELECT 1 FROM team_memberships tm
    JOIN user_profiles up ON tm.user_id = up.id
    WHERE up.id = auth.uid()
  )
);

-- Allow coaches and admins to delete thumbnail files
CREATE POLICY "Coaches can delete thumbnails" ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'game-thumbnails'
  AND EXISTS (
    SELECT 1 FROM team_memberships tm
    JOIN user_profiles up ON tm.user_id = up.id
    WHERE up.id = auth.uid()
    AND tm.role IN ('coach', 'admin')
  )
);

-- Add comments to document the new columns
COMMENT ON COLUMN public.games.thumbnail_url IS 'Original thumbnail URL from video source';
COMMENT ON COLUMN public.games.thumbnail_file_path IS 'Path to stored thumbnail JPEG in Supabase storage';
