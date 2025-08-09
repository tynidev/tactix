-- Migration to fix circular deletion conflict between trigger and CASCADE constraint
-- This removes auth.users deletion from trigger and updates the cleanup function

-- ==========================================
-- UPDATE TRIGGER FUNCTION
-- ==========================================

-- Remove auth.users deletion from trigger to avoid circular CASCADE conflict
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
    
    -- Note: We no longer delete from auth.users here to avoid CASCADE conflict
    -- The delete_user_cleanup() function now handles auth.users deletion directly
    
    -- Allow the deletion to proceed (CASCADE will handle the rest)
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- UPDATE CONVENIENCE FUNCTION
-- ==========================================

-- Update the function to delete from auth.users instead of user_profiles
-- This lets the CASCADE constraint handle user_profiles deletion automatically
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
    
    -- Delete from auth.users - this will CASCADE to user_profiles and trigger cleanup
    DELETE FROM auth.users WHERE id = p_user_id;
    
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
'Trigger function that handles audio file cleanup when a user_profile is deleted. 
Runs BEFORE DELETE to clean up coaching audio files from storage.
No longer deletes from auth.users to avoid CASCADE conflicts.';

COMMENT ON FUNCTION public.delete_user_cleanup(UUID) IS 
'Safe user deletion function that deletes a user and all related data.
Deletes from auth.users which CASCADE deletes user_profiles and triggers cleanup.
Returns JSON with success status and cleanup statistics.';

-- ==========================================
-- VERIFICATION
-- ==========================================

-- The new flow is:
-- 1. Call delete_user_cleanup(user_id)
-- 2. Function deletes from auth.users 
-- 3. CASCADE constraint deletes from user_profiles
-- 4. Trigger on user_profiles handles audio cleanup
-- 5. All other CASCADE deletes happen automatically

-- Test the fix (commented out for safety):
-- SELECT delete_user_cleanup('test-user-id');
