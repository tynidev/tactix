-- Migration to add comprehensive user deletion cleanup with CASCADE constraints and triggers
-- This ensures that deleting a user_profile automatically cleans up all related data

-- ==========================================
-- ALTER FOREIGN KEY CONSTRAINTS TO CASCADE
-- ==========================================

-- Change player_profiles.user_id from SET NULL to CASCADE
-- This will delete player profiles when user is deleted
ALTER TABLE public.player_profiles 
DROP CONSTRAINT IF EXISTS player_profiles_user_id_fkey;

ALTER TABLE public.player_profiles 
ADD CONSTRAINT player_profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Change guardian_player_relationships.player_user_id from SET NULL to CASCADE
-- This will delete guardian relationships when the child user is deleted
ALTER TABLE public.guardian_player_relationships 
DROP CONSTRAINT IF EXISTS guardian_player_relationships_player_user_id_fkey;

ALTER TABLE public.guardian_player_relationships 
ADD CONSTRAINT guardian_player_relationships_player_user_id_fkey 
FOREIGN KEY (player_user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- ==========================================
-- USER DELETION CLEANUP TRIGGER FUNCTION
-- ==========================================

-- Function to handle cleanup tasks that can't be done with CASCADE alone
CREATE OR REPLACE FUNCTION public.handle_user_deletion_cleanup()
RETURNS TRIGGER AS $$
DECLARE
    audio_file_record RECORD;
    audio_file_count INTEGER := 0;
    deleted_audio_count INTEGER := 0;
    error_message TEXT;
BEGIN
    -- Log the user deletion attempt
    RAISE LOG 'Starting cleanup for user deletion: % (%, %)', OLD.id, OLD.name, OLD.email;
    
    -- ==========================================
    -- COLLECT AND DELETE COACHING AUDIO FILES
    -- ==========================================
    
    -- Get all audio URLs from coaching points authored by this user
    FOR audio_file_record IN 
        SELECT DISTINCT audio_url 
        FROM public.coaching_points 
        WHERE author_id = OLD.id 
        AND audio_url IS NOT NULL 
        AND audio_url != ''
    LOOP
        audio_file_count := audio_file_count + 1;
        
        -- Attempt to delete audio file from storage (non-blocking)
        BEGIN
            -- Extract file path from URL for storage deletion
            -- Assuming audio_url format is like: https://domain/storage/v1/object/public/coaching-audio/path
            PERFORM storage.delete_object('coaching-audio', 
                regexp_replace(audio_file_record.audio_url, '^.*/coaching-audio/', ''));
            
            deleted_audio_count := deleted_audio_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            error_message := SQLERRM;
            RAISE WARNING 'Failed to delete audio file % for user %: %', 
                audio_file_record.audio_url, OLD.id, error_message;
        END;
    END LOOP;
    
    -- Log audio cleanup results
    IF audio_file_count > 0 THEN
        RAISE LOG 'Audio cleanup for user %: attempted % files, successfully deleted % files', 
            OLD.id, audio_file_count, deleted_audio_count;
    END IF;
    
    -- ==========================================
    -- DELETE FROM AUTH.USERS
    -- ==========================================
    
    -- Delete from Supabase auth.users table
    -- This is done BEFORE the CASCADE deletes happen
    BEGIN
        DELETE FROM auth.users WHERE id = OLD.id;
        RAISE LOG 'Successfully deleted auth.users record for user %', OLD.id;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        error_message := SQLERRM;
        RAISE WARNING 'Failed to delete auth.users record for user %: %', OLD.id, error_message;
    END;
    
    -- Allow the deletion to proceed (CASCADE will handle the rest)
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- CREATE TRIGGER
-- ==========================================

-- Create trigger to run cleanup before user deletion
DROP TRIGGER IF EXISTS user_deletion_cleanup_trigger ON public.user_profiles;

CREATE TRIGGER user_deletion_cleanup_trigger
    BEFORE DELETE ON public.user_profiles
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_user_deletion_cleanup();

-- ==========================================
-- CONVENIENCE FUNCTION FOR SAFE USER DELETION
-- ==========================================

-- Create a transaction function that can be called to safely delete a user
-- This provides a clean API and returns status information
CREATE OR REPLACE FUNCTION public.delete_user_cleanup(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    user_record RECORD;
    coaching_points_count INTEGER;
    player_profiles_count INTEGER;
    team_memberships_count INTEGER;
    result JSONB;
BEGIN
    -- Validate user exists
    SELECT id, name, email INTO user_record
    FROM public.user_profiles 
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Collect statistics before deletion
    SELECT COUNT(*) INTO coaching_points_count
    FROM public.coaching_points 
    WHERE author_id = p_user_id;
    
    SELECT COUNT(*) INTO player_profiles_count
    FROM public.player_profiles 
    WHERE user_id = p_user_id;
    
    SELECT COUNT(*) INTO team_memberships_count
    FROM public.team_memberships 
    WHERE user_id = p_user_id;
    
    -- Perform the deletion (trigger will handle cleanup, CASCADE will handle the rest)
    DELETE FROM public.user_profiles WHERE id = p_user_id;
    
    -- Return success with statistics
    result := jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', user_record.id,
            'name', user_record.name,
            'email', user_record.email
        ),
        'cleanup_stats', jsonb_build_object(
            'coaching_points_deleted', coaching_points_count,
            'player_profiles_deleted', player_profiles_count,
            'team_memberships_deleted', team_memberships_count
        ),
        'message', 'User and all related data successfully deleted'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'user_id', p_user_id
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- COMMENTS AND DOCUMENTATION
-- ==========================================

COMMENT ON FUNCTION public.handle_user_deletion_cleanup() IS 
'Trigger function that handles cleanup tasks when a user_profile is deleted. 
Deletes coaching audio files and auth.users record before CASCADE deletes take effect.';

COMMENT ON FUNCTION public.delete_user_cleanup(UUID) IS 
'Safe user deletion function that deletes a user and all related data.
Returns JSON with success status and cleanup statistics.
Triggers automatic CASCADE deletion of all related records.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.delete_user_cleanup(UUID) TO authenticated;
