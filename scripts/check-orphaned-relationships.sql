-- Script to check for orphaned relationships in the database
-- This can be run independently in any SQL client or Supabase dashboard

-- ==========================================
-- SCAN ONLY (Recommended first run)
-- ==========================================
-- This will show all orphaned relationships without making any changes
SELECT detect_orphaned_relationships() AS orphaned_scan_results;

-- ==========================================
-- CLEANUP MODE (Uncomment to run)
-- ==========================================
-- WARNING: This will automatically fix orphaned relationships
-- Make sure to review the scan results above before running this!

-- SELECT detect_orphaned_relationships(true) AS orphaned_cleanup_results;

-- ==========================================
-- EXAMPLE QUERIES FOR MANUAL INVESTIGATION
-- ==========================================

-- Check for player_profiles with invalid user_id
-- SELECT pp.id, pp.name, pp.user_id 
-- FROM player_profiles pp 
-- WHERE pp.user_id IS NOT NULL 
-- AND NOT EXISTS (
--     SELECT 1 FROM user_profiles up 
--     WHERE up.id = pp.user_id
-- );

-- Check for team_players with invalid references
-- SELECT tp.id, tp.team_id, tp.player_id 
-- FROM team_players tp 
-- WHERE NOT EXISTS (
--     SELECT 1 FROM teams t 
--     WHERE t.id = tp.team_id
-- ) OR NOT EXISTS (
--     SELECT 1 FROM player_profiles pp 
--     WHERE pp.id = tp.player_id
-- );

-- Check for coaching_points with invalid references
-- SELECT cp.id, cp.title, cp.game_id, cp.author_id 
-- FROM coaching_points cp 
-- WHERE NOT EXISTS (
--     SELECT 1 FROM games g 
--     WHERE g.id = cp.game_id
-- ) OR NOT EXISTS (
--     SELECT 1 FROM user_profiles up 
--     WHERE up.id = cp.author_id
-- );

-- ==========================================
-- USAGE NOTES
-- ==========================================
-- 1. Always run the scan first to see what would be affected
-- 2. Review the orphaned_ids in the results
-- 3. Uncomment the cleanup query only after reviewing scan results
-- 4. Run during low-traffic periods for best performance
-- 5. Monitor database logs for any issues
