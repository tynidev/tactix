-- Helper functions and procedures for development and testing

-- ==========================================
-- UTILITY FUNCTIONS
-- ==========================================

-- Function to join a team using a join code
CREATE OR REPLACE FUNCTION public.join_team_with_code(
    join_code TEXT,
    user_id_param UUID DEFAULT auth.uid()
)
RETURNS JSONB AS $$
DECLARE
    code_record RECORD;
    membership_id UUID;
    result JSONB;
BEGIN
    -- Validate input
    IF user_id_param IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;

    -- Find the join code
    SELECT tjc.*, t.name as team_name
    INTO code_record
    FROM public.team_join_codes tjc
    JOIN public.teams t ON tjc.team_id = t.id
    WHERE tjc.code = join_code
        AND tjc.is_active = true
        AND (tjc.expires_at IS NULL OR tjc.expires_at > NOW());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired join code');
    END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM public.team_memberships 
        WHERE team_id = code_record.team_id AND user_id = user_id_param
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'User is already a member of this team',
            'team_name', code_record.team_name
        );
    END IF;

    -- Add user to team
    INSERT INTO public.team_memberships (team_id, user_id, role)
    VALUES (code_record.team_id, user_id_param, COALESCE(code_record.team_role, 'player'))
    RETURNING id INTO membership_id;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', code_record.team_id,
        'team_name', code_record.team_name,
        'role', COALESCE(code_record.team_role, 'player'),
        'membership_id', membership_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a team and make the creator a coach
CREATE OR REPLACE FUNCTION public.create_team_with_creator(
    team_name TEXT,
    creator_id UUID DEFAULT auth.uid()
)
RETURNS JSONB AS $$
DECLARE
    new_team_id UUID;
    membership_id UUID;
BEGIN
    -- Validate input
    IF creator_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;

    IF team_name IS NULL OR trim(team_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Team name is required');
    END IF;

    -- Create the team
    INSERT INTO public.teams (name)
    VALUES (trim(team_name))
    RETURNING id INTO new_team_id;

    -- Add creator as coach
    INSERT INTO public.team_memberships (team_id, user_id, role)
    VALUES (new_team_id, creator_id, 'coach')
    RETURNING id INTO membership_id;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', new_team_id,
        'team_name', trim(team_name),
        'role', 'coach',
        'membership_id', membership_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's teams with role information
CREATE OR REPLACE FUNCTION public.get_user_teams(user_id_param UUID DEFAULT auth.uid())
RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    user_role public.team_role,
    created_at TIMESTAMP WITH TIME ZONE,
    member_count BIGINT
) AS $$
BEGIN
    IF user_id_param IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        t.id as team_id,
        t.name as team_name,
        tm.role as user_role,
        t.created_at,
        (SELECT COUNT(*) FROM public.team_memberships tm2 WHERE tm2.team_id = t.id) as member_count
    FROM public.teams t
    JOIN public.team_memberships tm ON t.id = tm.team_id
    WHERE tm.user_id = user_id_param
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team members with player profile information
CREATE OR REPLACE FUNCTION public.get_team_members_with_players(team_id_param UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    user_role public.team_role,
    player_profile_id UUID,
    player_name TEXT,
    jersey_number TEXT
) AS $$
BEGIN
    -- Check if user has access to this team
    IF NOT EXISTS (
        SELECT 1 FROM public.team_memberships 
        WHERE team_id = team_id_param AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied to team';
    END IF;

    RETURN QUERY
    SELECT 
        up.id as user_id,
        up.name as user_name,
        up.email as user_email,
        tm.role as user_role,
        pp.id as player_profile_id,
        pp.name as player_name,
        pp.jersey_number
    FROM public.team_memberships tm
    JOIN public.user_profiles up ON tm.user_id = up.id
    LEFT JOIN public.player_profiles pp ON up.id = pp.user_id
    LEFT JOIN public.team_players tp ON pp.id = tp.player_id AND tp.team_id = team_id_param
    WHERE tm.team_id = team_id_param
    ORDER BY tm.role, up.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- DEVELOPMENT SEED DATA FUNCTION
-- ==========================================

-- Function to create sample data for development
CREATE OR REPLACE FUNCTION public.create_sample_data()
RETURNS TEXT AS $$
DECLARE
    sample_team_id UUID;
    sample_game_id UUID;
    sample_player_id UUID;
    sample_coach_id UUID;
BEGIN
    -- This should only be used in development
    IF current_setting('app.environment', true) = 'production' THEN
        RETURN 'Sample data creation is disabled in production';
    END IF;

    -- Create sample team
    INSERT INTO public.teams (name) 
    VALUES ('Sample Soccer Team') 
    RETURNING id INTO sample_team_id;

    -- Create sample users would need to be done through Supabase Auth
    -- This is just for reference of the structure

    RETURN 'Sample data structure ready. Use Supabase Auth to create actual users.';
END;
$$ LANGUAGE plpgsql;
