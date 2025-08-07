-- Add transaction function for join team operation
-- This provides atomic all-or-nothing behavior for team joining

CREATE OR REPLACE FUNCTION join_team_transaction(
  p_user_id UUID,
  p_team_id UUID,
  p_role TEXT,
  p_player_data JSONB DEFAULT NULL,
  p_user_name TEXT DEFAULT 'Player'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_membership_id UUID;
  v_existing_membership_role TEXT;
  v_player_profile_id UUID;
  v_team_membership_id UUID;
  v_jersey_number TEXT;
  v_result JSONB;
BEGIN
  -- Validate role parameter
  IF p_role NOT IN ('coach', 'player', 'admin', 'guardian') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be one of: coach, player, admin, guardian', p_role;
  END IF;

  -- Check if user is already a member of this team
  SELECT id, role INTO v_existing_membership_id, v_existing_membership_role
  FROM team_memberships
  WHERE team_id = p_team_id AND user_id = p_user_id;

  -- If already a member with same role, return early
  IF v_existing_membership_id IS NOT NULL AND v_existing_membership_role = p_role THEN
    -- User is already a member with the same role - this is idempotent success
    v_team_membership_id := v_existing_membership_id;
    -- Still handle any player-specific logic if needed
    -- Then return success at the end
  END IF;

  -- Handle team membership (create new or update existing)
  IF v_existing_membership_id IS NULL THEN
    -- Create new membership
    INSERT INTO team_memberships (team_id, user_id, role)
    VALUES (p_team_id, p_user_id, p_role::team_role)
    RETURNING id INTO v_team_membership_id;
  ELSE
    -- Update existing membership role
    UPDATE team_memberships
    SET role = p_role::team_role
    WHERE id = v_existing_membership_id;
    v_team_membership_id := v_existing_membership_id;
  END IF;

  -- Extract jersey number and validate if player data is provided
  IF p_player_data IS NOT NULL THEN
    -- Get jersey number if provided
    v_jersey_number := NULLIF(trim(p_player_data->>'jerseyNumber'), '');
    
    -- Validate jersey number format if provided
    IF v_jersey_number IS NOT NULL AND NOT (v_jersey_number ~ '^\d{1,2}$') THEN
      RAISE EXCEPTION 'Jersey number must be 1-2 digits only';
    END IF;
  END IF;

  -- Handle Player role specific logic
  IF p_role = 'player' THEN
    IF p_player_data IS NOT NULL THEN
      IF (p_player_data->>'isNewPlayer')::BOOLEAN = false THEN
        -- Link to existing player profile
        v_player_profile_id := (p_player_data->>'id')::UUID;
        
        -- Verify player profile exists
        IF NOT EXISTS (SELECT 1 FROM player_profiles WHERE id = v_player_profile_id) THEN
          RAISE EXCEPTION 'Player profile with ID % does not exist', v_player_profile_id;
        END IF;
        
        -- Check if player profile is already linked to another user
        IF EXISTS (
          SELECT 1 FROM player_profiles 
          WHERE id = v_player_profile_id AND user_id IS NOT NULL AND user_id != p_user_id
        ) THEN
          RAISE EXCEPTION 'Player profile is already linked to another user';
        END IF;
        
        -- Link player profile to user
        UPDATE player_profiles 
        SET user_id = p_user_id 
        WHERE id = v_player_profile_id;
      ELSE
        -- Check if user already has a player profile
        SELECT id INTO v_player_profile_id
        FROM player_profiles
        WHERE user_id = p_user_id;
        
        IF v_player_profile_id IS NULL THEN
          -- Create new player profile
          INSERT INTO player_profiles (name, user_id)
          VALUES (COALESCE(p_player_data->>'name', p_user_name), p_user_id)
          RETURNING id INTO v_player_profile_id;
        END IF;
      END IF;
      
      -- Add player to team if not already added
      IF NOT EXISTS (
        SELECT 1 FROM team_players 
        WHERE team_id = p_team_id AND player_id = v_player_profile_id
      ) THEN
        INSERT INTO team_players (team_id, player_id, jersey_number)
        VALUES (p_team_id, v_player_profile_id, v_jersey_number);
      ELSE
        -- Update jersey number if provided and different
        IF v_jersey_number IS NOT NULL THEN
          UPDATE team_players 
          SET jersey_number = v_jersey_number
          WHERE team_id = p_team_id AND player_id = v_player_profile_id;
        END IF;
      END IF;
    END IF;
  
  -- Handle Guardian role specific logic
  ELSIF p_role = 'guardian' THEN
    IF p_player_data IS NOT NULL THEN
      IF (p_player_data->>'isNewPlayer')::BOOLEAN = true THEN
        -- Create new player profile for guardian's child
        INSERT INTO player_profiles (name, user_id)
        VALUES (
          (p_player_data->>'name')::TEXT, 
          CASE 
            WHEN p_player_data->>'user_id' IS NOT NULL 
            THEN (p_player_data->>'user_id')::UUID 
            ELSE NULL 
          END
        )
        RETURNING id INTO v_player_profile_id;
      ELSE
        -- Link to existing player profile
        v_player_profile_id := (p_player_data->>'id')::UUID;
        
        -- Verify player profile exists
        IF NOT EXISTS (SELECT 1 FROM player_profiles WHERE id = v_player_profile_id) THEN
          RAISE EXCEPTION 'Player profile with ID % does not exist', v_player_profile_id;
        END IF;
        
        -- Update user_id if provided
        IF p_player_data->>'user_id' IS NOT NULL THEN
          UPDATE player_profiles 
          SET user_id = (p_player_data->>'user_id')::UUID
          WHERE id = v_player_profile_id;
        END IF;
      END IF;
      
      -- Create guardian relationship if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM guardian_player_relationships 
        WHERE guardian_id = p_user_id AND player_profile_id = v_player_profile_id
      ) THEN
        INSERT INTO guardian_player_relationships (guardian_id, player_user_id, player_profile_id)
        VALUES (
          p_user_id,
          CASE 
            WHEN p_player_data->>'user_id' IS NOT NULL 
            THEN (p_player_data->>'user_id')::UUID 
            ELSE NULL 
          END,
          v_player_profile_id
        );
      END IF;
      
      -- Add player to team if not already added
      IF NOT EXISTS (
        SELECT 1 FROM team_players 
        WHERE team_id = p_team_id AND player_id = v_player_profile_id
      ) THEN
        INSERT INTO team_players (team_id, player_id, jersey_number)
        VALUES (p_team_id, v_player_profile_id, v_jersey_number);
      ELSE
        -- Update jersey number if provided and different
        IF v_jersey_number IS NOT NULL THEN
          UPDATE team_players 
          SET jersey_number = v_jersey_number
          WHERE team_id = p_team_id AND player_id = v_player_profile_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'team_membership_id', v_team_membership_id,
    'player_profile_id', v_player_profile_id,
    'role', p_role
  );

  RETURN v_result;
END;
$$;
