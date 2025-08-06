-- Move jersey_number from player_profiles to team_players
-- This migration safely moves the jersey_number field to the correct table
-- where it belongs (players can have different numbers on different teams)

BEGIN;

-- Add jersey_number column to team_players table
ALTER TABLE public.team_players 
ADD COLUMN jersey_number TEXT;

-- Migrate existing jersey numbers from player_profiles to team_players
-- This copies the jersey number to ALL team_players records for each player
UPDATE public.team_players 
SET jersey_number = pp.jersey_number
FROM public.player_profiles pp
WHERE public.team_players.player_id = pp.id
  AND pp.jersey_number IS NOT NULL;

-- Remove jersey_number column from player_profiles
ALTER TABLE public.player_profiles 
DROP COLUMN jersey_number;

COMMIT;
