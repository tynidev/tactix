-- Storage buckets for TACTIX application

-- Create bucket for audio recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-recordings',
  'audio-recordings',
  false,
  10485760, -- 10MB limit
  ARRAY['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
);

-- Create bucket for drawing data/exports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'drawing-exports',
  'drawing-exports',
  false,
  5242880, -- 5MB limit
  ARRAY['application/json', 'image/png', 'image/svg+xml']
);

-- Storage policies for audio recordings
CREATE POLICY "Team members can view audio recordings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'audio-recordings'
    AND (storage.foldername(name))[1] IN (
      SELECT g.id::text FROM games g
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can upload audio recordings" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio-recordings'
    AND (storage.foldername(name))[1] IN (
      SELECT g.id::text FROM games g
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can delete audio recordings" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio-recordings'
    AND (storage.foldername(name))[1] IN (
      SELECT g.id::text FROM games g
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('coach', 'admin')
    )
  );

-- Storage policies for drawing exports
CREATE POLICY "Team members can view drawing exports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'drawing-exports'
    AND (storage.foldername(name))[1] IN (
      SELECT g.id::text FROM games g
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage drawing exports" ON storage.objects
  FOR ALL USING (
    bucket_id = 'drawing-exports'
    AND (storage.foldername(name))[1] IN (
      SELECT g.id::text FROM games g
      JOIN team_memberships tm ON g.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
      AND tm.role IN ('coach', 'admin')
    )
  );
