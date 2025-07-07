-- Migration to add a trigger for cascading deletes of coaching point audio from storage.

-- This function is triggered when a row is deleted from the coaching_points table.
-- It extracts the file path from the audio_url and deletes the corresponding object
-- from the coaching-audio storage bucket.
CREATE OR REPLACE FUNCTION public.delete_coaching_audio_on_point_delete()
RETURNS TRIGGER AS $$
DECLARE
  file_path TEXT;
BEGIN
  -- Check if the deleted coaching point had an associated audio file URL.
  IF OLD.audio_url IS NOT NULL THEN
    -- Extract the file path from the URL. The path is assumed to be everything
    -- after the 'coaching-audio/' segment in the URL.
    file_path := regexp_replace(OLD.audio_url, '^.*/coaching-audio/', '');

    -- If a file path was successfully extracted, delete the file from the storage bucket.
    IF file_path <> OLD.audio_url THEN
      DELETE FROM storage.objects WHERE bucket_id = 'coaching-audio' AND name = file_path;
    END IF;
  END IF;

  -- Return the old row data to complete the delete operation.
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This trigger fires after a coaching point is deleted. It calls the function
-- to remove the associated audio file from storage.
CREATE TRIGGER on_coaching_point_deleted
  AFTER DELETE ON public.coaching_points
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_coaching_audio_on_point_delete();
