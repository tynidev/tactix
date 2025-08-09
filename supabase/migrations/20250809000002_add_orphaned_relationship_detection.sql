-- Migration to add orphaned relationship detection functionality
-- This provides comprehensive checks for referential integrity across all tables

-- ==========================================
-- ORPHANED RELATIONSHIP DETECTION FUNCTION
-- ==========================================

-- Function to detect orphaned relationships across all tables
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
    -- 12. CHECK COACHING_POINT_VIEWS
    -- ==========================================
    
    -- Check invalid point_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_views cpv
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coaching_points cp 
        WHERE cp.id = cpv.point_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_views',
            'foreign_key', 'point_id',
            'references', 'coaching_points.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpv.id)
                FROM public.coaching_point_views cpv
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.coaching_points cp 
                    WHERE cp.id = cpv.point_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_views 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.coaching_points cp 
                WHERE cp.id = point_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_views',
                'action', 'DELETE (invalid point_id)',
                'records_affected', orphaned_count
            );
        END IF;
    END IF;
    
    -- Check invalid player_id
    SELECT COUNT(*) INTO orphaned_count
    FROM public.coaching_point_views cpv
    WHERE NOT EXISTS (
        SELECT 1 FROM public.player_profiles pp 
        WHERE pp.id = cpv.player_id
    );
    
    IF orphaned_count > 0 THEN
        total_orphaned := total_orphaned + orphaned_count;
        
        temp_result := jsonb_build_object(
            'table', 'coaching_point_views',
            'foreign_key', 'player_id',
            'references', 'player_profiles.id',
            'count', orphaned_count,
            'orphaned_ids', (
                SELECT jsonb_agg(cpv.id)
                FROM public.coaching_point_views cpv
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.player_profiles pp 
                    WHERE pp.id = cpv.player_id
                )
            ),
            'cleanup_action', 'DELETE record'
        );
        
        orphaned_details := orphaned_details || temp_result;
        
        IF p_cleanup_mode THEN
            DELETE FROM public.coaching_point_views 
            WHERE NOT EXISTS (
                SELECT 1 FROM public.player_profiles pp 
                WHERE pp.id = player_id
            );
            
            cleanup_results := cleanup_results || jsonb_build_object(
                'table', 'coaching_point_views',
                'action', 'DELETE (invalid player_id)',
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

-- ==========================================
-- COMMENTS AND PERMISSIONS
-- ==========================================

COMMENT ON FUNCTION public.detect_orphaned_relationships(BOOLEAN) IS 
'Comprehensive function to detect and optionally clean up orphaned relationships across all tables.
Set cleanup_mode=true to automatically fix orphaned relationships.
Returns detailed JSON report of findings and actions taken.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.detect_orphaned_relationships(BOOLEAN) TO authenticated;
