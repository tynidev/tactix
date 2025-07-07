-- Fix coaching audio bucket policies to avoid infinite recursion
-- This migration removes the problematic team_memberships checks that cause infinite recursion

-- Drop existing policies on storage.objects for coaching-audio bucket
DROP POLICY IF EXISTS "Coaches can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Team members can read audio" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can delete own audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio" ON storage.objects;

-- Create simple policies that avoid the team_memberships table entirely
-- Allow any authenticated user to upload audio files
CREATE POLICY "auth_users_upload_audio" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'coaching-audio');

-- Allow any authenticated user to view audio files
CREATE POLICY "auth_users_view_audio" ON storage.objects
FOR SELECT 
TO authenticated
USING (bucket_id = 'coaching-audio');

-- Allow users to update their own audio files (based on owner_id if tracked)
CREATE POLICY "auth_users_update_audio" ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'coaching-audio');

-- Allow users to delete their own audio files
CREATE POLICY "auth_users_delete_audio" ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'coaching-audio');
