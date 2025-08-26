-- Create a function to delete files from Supabase storage
-- This function uses the storage.delete() function which is available in Supabase
CREATE OR REPLACE FUNCTION delete_storage_file(file_path TEXT, bucket_name TEXT DEFAULT 'game-thumbnails')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result BOOLEAN := FALSE;
BEGIN
  -- Only proceed if file_path is provided and not empty
  IF file_path IS NULL OR trim(file_path) = '' THEN
    RETURN FALSE;
  END IF;

  BEGIN
    -- Use Supabase's storage.delete function to remove the file
    -- The storage.delete function returns the number of files deleted
    SELECT storage.delete(ARRAY[file_path], bucket_name) > 0 INTO result;
    
    -- Log successful deletion
    IF result THEN
      RAISE LOG 'Successfully deleted storage file: % from bucket: %', file_path, bucket_name;
    ELSE
      RAISE LOG 'Storage file not found or already deleted: % in bucket: %', file_path, bucket_name;
    END IF;
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the operation
    RAISE LOG 'Failed to delete storage file: % from bucket: %. Error: %', file_path, bucket_name, SQLERRM;
    RETURN FALSE;
  END;
END;
$$;

-- Create a trigger function to cleanup game thumbnails when a game is deleted
CREATE OR REPLACE FUNCTION cleanup_game_thumbnails()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the deleted game had a thumbnail file path
  IF OLD.thumbnail_file_path IS NOT NULL AND trim(OLD.thumbnail_file_path) != '' THEN
    -- Attempt to delete the thumbnail file from storage
    -- We don't check the return value because we don't want to fail the deletion
    -- if storage cleanup fails
    PERFORM delete_storage_file(OLD.thumbnail_file_path, 'game-thumbnails');
    
    RAISE LOG 'Triggered thumbnail cleanup for game: % with file: %', OLD.id, OLD.thumbnail_file_path;
  END IF;
  
  -- Return OLD for AFTER DELETE triggers
  RETURN OLD;
END;
$$;

-- Create the trigger that fires after a game is deleted
DROP TRIGGER IF EXISTS games_cleanup_thumbnails ON public.games;
CREATE TRIGGER games_cleanup_thumbnails
  AFTER DELETE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_game_thumbnails();

-- Add a comment explaining the trigger
COMMENT ON TRIGGER games_cleanup_thumbnails ON public.games IS 
'Automatically deletes thumbnail files from Supabase storage when a game record is deleted. This provides database-level cleanup as a safety net in addition to application-level cleanup.';

-- Add comments to document the functions
COMMENT ON FUNCTION delete_storage_file(TEXT, TEXT) IS 
'Deletes a file from Supabase storage. Returns TRUE if successful, FALSE otherwise. Logs errors but does not raise exceptions.';

COMMENT ON FUNCTION cleanup_game_thumbnails() IS 
'Trigger function that cleans up thumbnail files when games are deleted. Called automatically by the games_cleanup_thumbnails trigger.';
