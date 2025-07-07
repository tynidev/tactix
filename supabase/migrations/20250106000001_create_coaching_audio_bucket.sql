-- Create storage bucket for coaching audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('coaching-audio', 'coaching-audio', true);

-- Set up RLS policy for coaching audio bucket
-- Allow coaches and admins to upload files
CREATE POLICY "Coaches can upload audio" ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'coaching-audio' 
  AND EXISTS (
    SELECT 1 FROM team_memberships tm
    JOIN user_profiles up ON tm.user_id = up.id
    WHERE up.id = auth.uid()
    AND tm.role IN ('coach', 'admin')
  )
);

-- Allow anyone in the team to read/download audio files
CREATE POLICY "Team members can read audio" ON storage.objects
FOR SELECT 
USING (
  bucket_id = 'coaching-audio'
  AND EXISTS (
    SELECT 1 FROM team_memberships tm
    JOIN user_profiles up ON tm.user_id = up.id
    WHERE up.id = auth.uid()
  )
);

-- Allow coaches and admins to delete their own audio files
CREATE POLICY "Coaches can delete own audio" ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'coaching-audio'
  AND EXISTS (
    SELECT 1 FROM team_memberships tm
    JOIN user_profiles up ON tm.user_id = up.id
    WHERE up.id = auth.uid()
    AND tm.role IN ('coach', 'admin')
  )
);
