-- Rename coaching_point_views table to coaching_point_acknowledgments
ALTER TABLE coaching_point_views RENAME TO coaching_point_acknowledgments;

-- Drop the viewed_at column as it will be tracked separately in view analytics
ALTER TABLE coaching_point_acknowledgments DROP COLUMN viewed_at;

-- Update the comment on the table to reflect its new purpose
COMMENT ON TABLE coaching_point_acknowledgments IS 'Tracks player acknowledgments of coaching points';

-- Rename indexes
ALTER INDEX IF EXISTS idx_coaching_point_views_point_id RENAME TO idx_coaching_point_acknowledgments_point_id;
ALTER INDEX IF EXISTS idx_coaching_point_views_player_id RENAME TO idx_coaching_point_acknowledgments_player_id;
ALTER INDEX IF EXISTS idx_coaching_point_views_acknowledged RENAME TO idx_coaching_point_acknowledgments_acknowledged;
ALTER INDEX IF EXISTS coaching_point_views_pkey RENAME TO coaching_point_acknowledgments_pkey;
ALTER INDEX IF EXISTS coaching_point_views_point_id_player_id_key RENAME TO coaching_point_acknowledgments_point_id_player_id_key;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Players can view their own coaching point views" ON coaching_point_acknowledgments;
DROP POLICY IF EXISTS "Coaches and admins can view all coaching point views for their team" ON coaching_point_acknowledgments;
DROP POLICY IF EXISTS "Players can update their own coaching point views" ON coaching_point_acknowledgments;
DROP POLICY IF EXISTS "System can insert coaching point views" ON coaching_point_acknowledgments;
DROP POLICY IF EXISTS "Guardians can view coaching point views for their players" ON coaching_point_acknowledgments;
DROP POLICY IF EXISTS "Guardians can update coaching point views for their players" ON coaching_point_acknowledgments;
DROP POLICY IF EXISTS "Guardians can insert coaching point views for their players" ON coaching_point_acknowledgments;

-- Create new RLS policies with updated names
CREATE POLICY "Players can view their own acknowledgments" ON coaching_point_acknowledgments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM player_profiles pp
            WHERE pp.id = player_id AND pp.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can view all acknowledgments for their team" ON coaching_point_acknowledgments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

CREATE POLICY "Players can update their own acknowledgments" ON coaching_point_acknowledgments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM player_profiles pp
            WHERE pp.id = player_id AND pp.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert acknowledgments" ON coaching_point_acknowledgments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Guardians can view acknowledgments for their players" ON coaching_point_acknowledgments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM guardian_player_relationships gpr
            WHERE gpr.guardian_id = auth.uid() 
            AND gpr.player_profile_id = player_id
        )
    );

CREATE POLICY "Guardians can update acknowledgments for their players" ON coaching_point_acknowledgments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM guardian_player_relationships gpr
            WHERE gpr.guardian_id = auth.uid() 
            AND gpr.player_profile_id = player_id
        )
    );

CREATE POLICY "Guardians can insert acknowledgments for their players" ON coaching_point_acknowledgments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM guardian_player_relationships gpr
            WHERE gpr.guardian_id = auth.uid() 
            AND gpr.player_profile_id = player_id
        )
    );

-- Update the remove_player_from_team_transaction function
CREATE OR REPLACE FUNCTION remove_player_from_team_transaction(
  p_user_id UUID,
  p_team_id UUID,
  p_player_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role               team_role;
  v_player_profile_id       UUID;
  v_player_name             TEXT;
  v_player_user_id          UUID;
  v_player_jersey_number    TEXT;
  v_is_self_removal         BOOLEAN := FALSE;
  v_has_permission          BOOLEAN := FALSE;
  v_dummy                   UUID;
  v_result                  JSONB;
BEGIN
  -- 1. Validate acting user's membership & role
  SELECT role INTO v_user_role
  FROM team_memberships
  WHERE team_id = p_team_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % is not a member of team %', p_user_id, p_team_id;
  END IF;

  -- 2. Validate player is on team & collect profile info
  SELECT pp.id, pp.name, pp.user_id, tp.jersey_number
    INTO v_player_profile_id, v_player_name, v_player_user_id, v_player_jersey_number
  FROM team_players tp
  JOIN player_profiles pp ON pp.id = tp.player_id
  WHERE tp.team_id = p_team_id
    AND tp.player_id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found on team %', p_player_id, p_team_id;
  END IF;

  -- Determine self-removal
  v_is_self_removal := (v_player_user_id IS NOT NULL AND v_player_user_id = p_user_id);

  -- 3. Permission logic
  IF v_is_self_removal THEN
    v_has_permission := TRUE;
  ELSIF v_user_role IN ('coach', 'admin') THEN
    v_has_permission := TRUE;
  ELSIF v_user_role = 'guardian' THEN
    SELECT guardian_id INTO v_dummy
    FROM guardian_player_relationships
    WHERE guardian_id = p_user_id
      AND player_profile_id = v_player_profile_id
    LIMIT 1;
    IF FOUND THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'Insufficient permissions for user % to remove player % from team %', p_user_id, p_player_id, p_team_id;
  END IF;

  -- 4. Delete coaching_point_acknowledgments for this player (renamed from coaching_point_views)
  DELETE FROM coaching_point_acknowledgments
  WHERE player_id = v_player_profile_id;

  -- 5. Delete coaching_point_tagged_players entries for this player
  DELETE FROM coaching_point_tagged_players
  WHERE player_id = v_player_profile_id;

  -- 6. Remove the player from the team
  DELETE FROM team_players
  WHERE team_id = p_team_id AND player_id = v_player_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to delete team_players row for player % on team %', v_player_profile_id, p_team_id;
  END IF;

  -- 7. If self-removal also remove team membership
  IF v_is_self_removal THEN
    DELETE FROM team_memberships
    WHERE team_id = p_team_id AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invariant violation: expected to delete self membership for user % on team % but none found', p_user_id, p_team_id;
    END IF;
  END IF;

  -- 8. Build result JSON
  v_result := jsonb_build_object(
    'success', TRUE,
    'is_self_removal', v_is_self_removal,
    'player', jsonb_build_object(
      'player_profile_id', v_player_profile_id,
      'name', COALESCE(v_player_name, 'Unknown'),
      'jersey_number', v_player_jersey_number
    ),
    'message', CASE WHEN v_is_self_removal
      THEN 'You have left the team successfully'
      ELSE COALESCE(v_player_name, 'Unknown') ||
           CASE WHEN v_player_jersey_number IS NOT NULL THEN ' (#' || v_player_jersey_number || ')' ELSE '' END ||
           ' has been removed from the team'
      END
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Update the detect_orphaned_relationships function to reference coaching_point_acknowledgments
CREATE OR REPLACE FUNCTION public.detect_orphaned_relationships(
    p_cleanup_mode BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    orphaned_count INTEGER;
    total_orphaned INTEGER := 0;
    orphaned_details JSONB := '[]'::JSONB;
    cleanup_results JSONB := '[]'::JSONB;
    temp_result JSONB;
BEGIN
    -- ==========================================
    -- 1. CHECK PLAYER_PROFILES WITH INVALID USER_ID
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.player_profiles pp
    WHERE pp.user_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = pp.user_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        -- Get details of orphaned records
        temp_result := jsonb_build_object(
            'table', 'player_profiles',
            'foreign_key', 'user_id',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(pp.id)
                FROM public.player_profiles pp
                WHERE pp.user_id IS NOT NULL 
                AND NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = pp.user_id
                )
            ),
            'cleanup_action', 'SET user_id to NULL or DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        -- Cleanup if requested
        IF p_cleanup_mode THEN
            UPDATE public.player_profiles 
            SET user_id = NULL 
            WHERE user_id IS NOT NULL 
            AND NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = user_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'player_profiles',
                'action', 'SET user_id to NULL',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 2. CHECK TEAM_JOIN_CODES WITH INVALID CREATED_BY
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.team_join_codes tjc
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = tjc.created_by
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'team_join_codes',
            'foreign_key', 'created_by',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(tjc.id)
                FROM public.team_join_codes tjc
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = tjc.created_by
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.team_join_codes 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = created_by
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'team_join_codes',
                'action', 'DELETE',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 3. CHECK TEAM_PLAYERS WITH INVALID REFERENCES
    -- ==========================================
    
    -- Check invalid team_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.team_players tp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.id = tp.team_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'team_players',
            'foreign_key', 'team_id',
            'references', 'teams.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(tp.id)
                FROM public.team_players tp
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.teams t 
                    WHERE t.id = tp.team_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.team_players 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.teams t 
                WHERE t.id = team_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'team_players',
                'action', 'DELETE (invalid team_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid player_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.team_players tp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.player_profiles pp 
        WHERE pp.id = tp.player_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'team_players',
            'foreign_key', 'player_id',
            'references', 'player_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(tp.id)
                FROM public.team_players tp
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.player_profiles pp 
                    WHERE pp.id = tp.player_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.team_players 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.player_profiles pp 
                WHERE pp.id = player_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'team_players',
                'action', 'DELETE (invalid player_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 4. CHECK TEAM_MEMBERSHIPS WITH INVALID REFERENCES
    -- ==========================================
    
    -- Check invalid team_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.team_memberships tm
    WHERE NOT EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.id = tm.team_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'team_memberships',
            'foreign_key', 'team_id',
            'references', 'teams.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(tm.id)
                FROM public.team_memberships tm
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.teams t 
                    WHERE t.id = tm.team_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.team_memberships 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.teams t 
                WHERE t.id = team_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'team_memberships',
                'action', 'DELETE (invalid team_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid user_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.team_memberships tm
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = tm.user_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'team_memberships',
            'foreign_key', 'user_id',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(tm.id)
                FROM public.team_memberships tm
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = tm.user_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.team_memberships 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = user_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'team_memberships',
                'action', 'DELETE (invalid user_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 5. CHECK GUARDIAN_PLAYER_RELATIONSHIPS
    -- ==========================================
    
    -- Check invalid guardian_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.guardian_player_relationships gpr
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = gpr.guardian_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'guardian_player_relationships',
            'foreign_key', 'guardian_id',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(gpr.id)
                FROM public.guardian_player_relationships gpr
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = gpr.guardian_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.guardian_player_relationships 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = guardian_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'guardian_player_relationships',
                'action', 'DELETE (invalid guardian_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid player_user_id (nullable field)
    SELECT COUNT(*) INTO orphaned_count
    FROM public.guardian_player_relationships gpr
    WHERE gpr.player_user_id IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = gpr.player_user_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'guardian_player_relationships',
            'foreign_key', 'player_user_id',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(gpr.id)
                FROM public.guardian_player_relationships gpr
                WHERE gpr.player_user_id IS NOT NULL 
                AND NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = gpr.player_user_id
                )
            ),
            'cleanup_action', 'SET player_user_id to NULL'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            UPDATE public.guardian_player_relationships 
            SET player_user_id = NULL 
            WHERE player_user_id IS NOT NULL 
            AND NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = player_user_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'guardian_player_relationships',
                'action', 'SET player_user_id to NULL',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid player_profile_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.guardian_player_relationships gpr
    WHERE NOT EXISTS (
        SELECT 1 FROM public.player_profiles pp 
        WHERE pp.id = gpr.player_profile_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'guardian_player_relationships',
            'foreign_key', 'player_profile_id',
            'references', 'player_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(gpr.id)
                FROM public.guardian_player_relationships gpr
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.player_profiles pp 
                    WHERE pp.id = gpr.player_profile_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.guardian_player_relationships 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.player_profiles pp 
                WHERE pp.id = player_profile_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'guardian_player_relationships',
                'action', 'DELETE (invalid player_profile_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 6. CHECK GAMES WITH INVALID TEAM_ID
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.games g
    WHERE NOT EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.id = g.team_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'games',
            'foreign_key', 'team_id',
            'references', 'teams.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(g.id)
                FROM public.games g
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.teams t 
                    WHERE t.id = g.team_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.games 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.teams t 
                WHERE t.id = team_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'games',
                'action', 'DELETE',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 7. CHECK COACHING_POINTS WITH INVALID REFERENCES
    -- ==========================================
    
    -- Check invalid game_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_points cp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.games g 
        WHERE g.id = cp.game_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_points',
            'foreign_key', 'game_id',
            'references', 'games.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cp.id)
                FROM public.coaching_points cp
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.games g 
                    WHERE g.id = cp.game_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_points 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.games g 
                WHERE g.id = game_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_points',
                'action', 'DELETE (invalid game_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid author_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_points cp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = cp.author_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_points',
            'foreign_key', 'author_id',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cp.id)
                FROM public.coaching_points cp
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = cp.author_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_points 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = author_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_points',
                'action', 'DELETE (invalid author_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 8. CHECK COACHING_POINT_EVENTS WITH INVALID POINT_ID
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_events cpe
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coaching_points cp 
        WHERE cp.id = cpe.point_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_events',
            'foreign_key', 'point_id',
            'references', 'coaching_points.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpe.id)
                FROM public.coaching_point_events cpe
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.coaching_points cp 
                    WHERE cp.id = cpe.point_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_events 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.coaching_points cp 
                WHERE cp.id = point_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_events',
                'action', 'DELETE',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 9. CHECK COACHING_POINT_TAGGED_PLAYERS
    -- ==========================================
    
    -- Check invalid point_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_tagged_players cptp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coaching_points cp 
        WHERE cp.id = cptp.point_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_tagged_players',
            'foreign_key', 'point_id',
            'references', 'coaching_points.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cptp.id)
                FROM public.coaching_point_tagged_players cptp
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.coaching_points cp 
                    WHERE cp.id = cptp.point_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_tagged_players 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.coaching_points cp 
                WHERE cp.id = point_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_tagged_players',
                'action', 'DELETE (invalid point_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid player_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_tagged_players cptp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.player_profiles pp 
        WHERE pp.id = cptp.player_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_tagged_players',
            'foreign_key', 'player_id',
            'references', 'player_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cptp.id)
                FROM public.coaching_point_tagged_players cptp
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.player_profiles pp 
                    WHERE pp.id = cptp.player_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_tagged_players 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.player_profiles pp 
                WHERE pp.id = player_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_tagged_players',
                'action', 'DELETE (invalid player_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 10. CHECK LABELS WITH INVALID TEAM_ID
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.labels l
    WHERE NOT EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.id = l.team_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'labels',
            'foreign_key', 'team_id',
            'references', 'teams.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(l.id)
                FROM public.labels l
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.teams t 
                    WHERE t.id = l.team_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.labels 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.teams t 
                WHERE t.id = team_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'labels',
                'action', 'DELETE',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 11. CHECK COACHING_POINT_LABELS
    -- ==========================================
    
    -- Check invalid point_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_labels cpl
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coaching_points cp 
        WHERE cp.id = cpl.point_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_labels',
            'foreign_key', 'point_id',
            'references', 'coaching_points.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpl.id)
                FROM public.coaching_point_labels cpl
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.coaching_points cp 
                    WHERE cp.id = cpl.point_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_labels 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.coaching_points cp 
                WHERE cp.id = point_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_labels',
                'action', 'DELETE (invalid point_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid label_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_labels cpl
    WHERE NOT EXISTS (
        SELECT 1 FROM public.labels l 
        WHERE l.id = cpl.label_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_labels',
            'foreign_key', 'label_id',
            'references', 'labels.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpl.id)
                FROM public.coaching_point_labels cpl
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.labels l 
                    WHERE l.id = cpl.label_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_labels 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.labels l 
                WHERE l.id = label_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_labels',
                'action', 'DELETE (invalid label_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 12. CHECK COACHING_POINT_ACKNOWLEDGMENTS (renamed from COACHING_POINT_VIEWS)
    -- ==========================================
    
    -- Check invalid point_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_acknowledgments cpa
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coaching_points cp 
        WHERE cp.id = cpa.point_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_acknowledgments',
            'foreign_key', 'point_id',
            'references', 'coaching_points.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpa.id)
                FROM public.coaching_point_acknowledgments cpa
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.coaching_points cp 
                    WHERE cp.id = cpa.point_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_acknowledgments 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.coaching_points cp 
                WHERE cp.id = point_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_acknowledgments',
                'action', 'DELETE (invalid point_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid player_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_acknowledgments cpa
    WHERE NOT EXISTS (
        SELECT 1 FROM public.player_profiles pp 
        WHERE pp.id = cpa.player_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_acknowledgments',
            'foreign_key', 'player_id',
            'references', 'player_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpa.id)
                FROM public.coaching_point_acknowledgments cpa
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.player_profiles pp 
                    WHERE pp.id = cpa.player_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_acknowledgments 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.player_profiles pp 
                WHERE pp.id = player_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_acknowledgments',
                'action', 'DELETE (invalid player_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 13. CHECK TEAMS WITH INVALID CREATED_BY
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.teams t
    WHERE t.created_by IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = t.created_by
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'teams',
            'foreign_key', 'created_by',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(t.id)
                FROM public.teams t
                WHERE t.created_by IS NOT NULL 
                AND NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = t.created_by
                )
            ),
            'cleanup_action', 'SET created_by to NULL'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            UPDATE public.teams 
            SET created_by = NULL 
            WHERE created_by IS NOT NULL 
            AND NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = created_by
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'teams',
                'action', 'SET created_by to NULL',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- 14. CHECK PLAYER_PROFILES WITH INVALID CREATED_BY
    -- ==========================================
    
    SELECT COUNT(*) INTO orphaned_count
    FROM public.player_profiles pp
    WHERE pp.created_by IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up 
        WHERE up.id = pp.created_by
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'player_profiles',
            'foreign_key', 'created_by',
            'references', 'user_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(pp.id)
                FROM public.player_profiles pp
                WHERE pp.created_by IS NOT NULL 
                AND NOT EXISTS (
                    SELECT 1 FROM public.user_profiles up 
                    WHERE up.id = pp.created_by
                )
            ),
            'cleanup_action', 'SET created_by to NULL'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            UPDATE public.player_profiles 
            SET created_by = NULL 
            WHERE created_by IS NOT NULL 
            AND NOT EXISTS (
                SELECT 1 FROM public.user_profiles up 
                WHERE up.id = created_by
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'player_profiles',
                'action', 'SET created_by to NULL',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- ==========================================
    -- RETURN RESULTS
    -- ==========================================
    
    RETURN jsonb_build_object(
        'scan_completed_at', NOW(),
        'cleanup_mode', p_cleanup_mode,
        'total_orphaned_records', total_orphaned,
        'orphaned_relationships', orphaned_details,
        'cleanup_results', CASE WHEN p_cleanup_mode THEN cleanup_results ELSE NULL END,
        'summary', CASE 
            WHEN total_orphaned = 0 THEN 'No orphaned relationships found - database integrity is good!'
            WHEN p_cleanup_mode THEN format('Found and cleaned up %s orphaned relationships', total_orphaned)
            ELSE format('Found %s orphaned relationships - run with cleanup_mode=true to fix them', total_orphaned)
        END
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'scan_completed_at', NOW()
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the comment on the function to reflect the table rename
COMMENT ON FUNCTION public.detect_orphaned_relationships(BOOLEAN) IS 
'Comprehensive function to detect and optionally clean up orphaned relationships across all tables.
Set cleanup_mode=true to automatically fix orphaned relationships.
Returns detailed JSON report of findings and actions taken.
NOTE: This function references coaching_point_acknowledgments (renamed from coaching_point_views).';
