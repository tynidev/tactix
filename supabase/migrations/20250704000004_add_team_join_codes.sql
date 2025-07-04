-- Add join codes for each role type to teams table

-- Add join code columns to teams table
ALTER TABLE teams ADD COLUMN coach_join_code TEXT;
ALTER TABLE teams ADD COLUMN player_join_code TEXT;
ALTER TABLE teams ADD COLUMN admin_join_code TEXT;
ALTER TABLE teams ADD COLUMN parent_join_code TEXT;

-- Create unique constraints for join codes (globally unique across all teams)
ALTER TABLE teams ADD CONSTRAINT unique_coach_join_code UNIQUE (coach_join_code);
ALTER TABLE teams ADD CONSTRAINT unique_player_join_code UNIQUE (player_join_code);
ALTER TABLE teams ADD CONSTRAINT unique_admin_join_code UNIQUE (admin_join_code);
ALTER TABLE teams ADD CONSTRAINT unique_parent_join_code UNIQUE (parent_join_code);

-- Function to generate random join codes
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS TEXT AS $$
BEGIN
    RETURN upper(substring(md5(random()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Update existing teams with random join codes
UPDATE teams SET 
    coach_join_code = generate_join_code(),
    player_join_code = generate_join_code(),
    admin_join_code = generate_join_code(),
    parent_join_code = generate_join_code();

-- Make join code columns NOT NULL after populating existing records
ALTER TABLE teams ALTER COLUMN coach_join_code SET NOT NULL;
ALTER TABLE teams ALTER COLUMN player_join_code SET NOT NULL;
ALTER TABLE teams ALTER COLUMN admin_join_code SET NOT NULL;
ALTER TABLE teams ALTER COLUMN parent_join_code SET NOT NULL;

-- Create function to regenerate join codes for a specific role
CREATE OR REPLACE FUNCTION regenerate_team_join_code(team_uuid UUID, role_name TEXT) 
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    max_attempts INTEGER := 100;
    attempt INTEGER := 0;
BEGIN
    LOOP
        new_code := generate_join_code();
        attempt := attempt + 1;
        
        -- Check if code is unique across all role types
        IF NOT EXISTS (
            SELECT 1 FROM teams 
            WHERE coach_join_code = new_code 
               OR player_join_code = new_code 
               OR admin_join_code = new_code 
               OR parent_join_code = new_code
        ) THEN
            -- Update the appropriate column based on role
            CASE role_name
                WHEN 'coach' THEN
                    UPDATE teams SET coach_join_code = new_code WHERE id = team_uuid;
                WHEN 'player' THEN
                    UPDATE teams SET player_join_code = new_code WHERE id = team_uuid;
                WHEN 'admin' THEN
                    UPDATE teams SET admin_join_code = new_code WHERE id = team_uuid;
                WHEN 'parent' THEN
                    UPDATE teams SET parent_join_code = new_code WHERE id = team_uuid;
                ELSE
                    RAISE EXCEPTION 'Invalid role: %', role_name;
            END CASE;
            
            RETURN new_code;
        END IF;
        
        IF attempt >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique join code after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to find team by join code and return team info with role
CREATE OR REPLACE FUNCTION find_team_by_join_code(join_code_input TEXT)
RETURNS TABLE(team_id UUID, team_name TEXT, role_for_code TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        CASE 
            WHEN t.coach_join_code = join_code_input THEN 'coach'::TEXT
            WHEN t.player_join_code = join_code_input THEN 'player'::TEXT
            WHEN t.admin_join_code = join_code_input THEN 'admin'::TEXT
            WHEN t.parent_join_code = join_code_input THEN 'parent'::TEXT
        END as role_for_code
    FROM teams t
    WHERE t.coach_join_code = join_code_input 
       OR t.player_join_code = join_code_input 
       OR t.admin_join_code = join_code_input 
       OR t.parent_join_code = join_code_input;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for join code lookups
CREATE INDEX idx_teams_coach_join_code ON teams(coach_join_code);
CREATE INDEX idx_teams_player_join_code ON teams(player_join_code);
CREATE INDEX idx_teams_admin_join_code ON teams(admin_join_code);
CREATE INDEX idx_teams_parent_join_code ON teams(parent_join_code);
