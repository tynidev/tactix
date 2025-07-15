-- Add unique constraints for data integrity and performance
-- Migration: 20250715000001_add_unique_constraints

-- Unique constraint to prevent duplicate team memberships
-- This ensures a user can only have one role per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_memberships_unique 
ON public.team_memberships(team_id, user_id);

-- Unique constraint for email (data integrity)
-- Ensures no duplicate email addresses in the system
DO $$ 
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_email' 
        AND conrelid = 'public.user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT unique_email UNIQUE (email);
    END IF;
END $$;

-- Partial unique index for active join codes
-- Ensures only one active code with the same value can exist
-- This replaces any existing basic index on the code column for active codes
DROP INDEX IF EXISTS public.idx_team_join_codes_active;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_join_code 
ON public.team_join_codes(code) 
WHERE is_active = true;

-- Add comment explaining the rationale
COMMENT ON INDEX public.idx_team_memberships_unique IS 
'Ensures a user can only have one membership record per team, preventing duplicate roles';

COMMENT ON INDEX public.unique_active_join_code IS 
'Ensures only one active join code with the same value can exist across all teams';
