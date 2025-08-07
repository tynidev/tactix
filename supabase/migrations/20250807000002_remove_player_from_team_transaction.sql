-- Transactional function to remove a player from a team mirroring the API logic in
-- teams.ts (PUT /:teamId/players/:playerId/remove)
-- Ensures all-or-nothing semantics: if any permission check or delete fails, the
-- entire operation is rolled back automatically by the function's transaction.
--
-- Behavior:
-- 1. Validates the acting user is a member of the team and captures their role.
-- 2. Validates the player (player profile) is on the team.
-- 3. Permission logic:
--      - coach/admin: may remove any player
--      - guardian: only players where a guardian_player_relationships row links guardian->player
--      - player: may remove themselves (player profile's user_id matches acting user)
-- 4. Deletes related coaching_point_views rows (player scoped), then coaching_point_tagged_players rows.
-- 5. Deletes the team_players row (detaching the player from the team).
-- 6. If self-removal (player profile user matches acting user) also deletes that user's team_memberships row for the team.
-- 7. Returns JSONB describing the outcome (success, message, is_self_removal, player info).
--
-- NOTE: This function purposefully does NOT delete the underlying player_profiles row
-- nor any guardian_player_relationships entries (same as API).
--
-- Invocation example:
--   SELECT remove_player_from_team_transaction(
--     p_user_id => '...',
--     p_team_id => '...',
--     p_player_id => '...'
--   );
--
-- SECURITY: Marked SECURITY DEFINER so RLS policies must allow the definer to perform
-- the internal operations. Restrict direct grants as appropriate.

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
  v_dummy                   UUID; -- used for guardian relationship existence check
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
    v_has_permission := TRUE; -- players can remove themselves
  ELSIF v_user_role IN ('coach', 'admin') THEN
    v_has_permission := TRUE; -- coach/admin can remove any player
  ELSIF v_user_role = 'guardian' THEN
    -- guardian must have a relationship with player profile
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

  -- 4. Delete coaching_point_views for this player (player scoped)
  DELETE FROM coaching_point_views
  WHERE player_id = v_player_profile_id;
  -- (no row count requirement; zero rows is fine)

  -- 5. Delete coaching_point_tagged_players entries for this player
  DELETE FROM coaching_point_tagged_players
  WHERE player_id = v_player_profile_id;

  -- 6. Remove the player from the team (must affect exactly 1 row)
  DELETE FROM team_players
  WHERE team_id = p_team_id AND player_id = v_player_profile_id;
  IF NOT FOUND THEN
    -- Should not happen given earlier SELECT, but guard anyway
    RAISE EXCEPTION 'Failed to delete team_players row for player % on team %', v_player_profile_id, p_team_id;
  END IF;

  -- 7. If self-removal also remove team membership. This MUST succeed (row must exist)
  -- because earlier membership lookup (step 1) guarantees a membership row for the acting user.
  IF v_is_self_removal THEN
    DELETE FROM team_memberships
    WHERE team_id = p_team_id AND user_id = p_user_id;
    IF NOT FOUND THEN
      -- This indicates unexpected data inconsistency between earlier SELECT and now.
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
    -- Reraise with context; transaction will rollback automatically.
    RAISE;
END;
$$;

-- Optional: You may GRANT execute on this function to an application role, e.g.:
-- GRANT EXECUTE ON FUNCTION remove_player_from_team_transaction(UUID, UUID, UUID) TO authenticated;
