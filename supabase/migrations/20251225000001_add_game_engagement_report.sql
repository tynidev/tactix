-- Function to get player engagement report for a specific game
CREATE OR REPLACE FUNCTION get_game_engagement_report(p_team_id uuid, p_game_id uuid)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  points_viewed bigint,
  total_views numeric, -- SUM(view_count) might be bigint but COALESCE returns type of first arg. view_count is likely int.
  view_percentage numeric,
  avg_completion_percentage numeric,
  points_ackd bigint,
  points_note_written bigint,
  earliest_view timestamptz,
  latest_view timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH base_players AS (
  SELECT pp.id AS player_id, pp.name AS player_name
  FROM team_players tp
  JOIN player_profiles pp ON pp.id = tp.player_id
  WHERE tp.team_id = p_team_id
),
player_user_rows AS (
  SELECT pp.id AS player_id, pp.user_id
  FROM team_players tp
  JOIN player_profiles pp ON pp.id = tp.player_id
  WHERE tp.team_id = p_team_id
    AND pp.user_id IS NOT NULL
),
guardian_rows AS (
  SELECT pp.id AS player_id, gr.guardian_id AS user_id
  FROM team_players tp
  JOIN player_profiles pp ON pp.id = tp.player_id
  JOIN guardian_player_relationships gr ON gr.player_profile_id = pp.id
  WHERE tp.team_id = p_team_id
    AND pp.user_id IS NULL
),
effective_users AS (
  SELECT * FROM player_user_rows
  UNION ALL
  SELECT * FROM guardian_rows
),
game_points AS (
  SELECT id AS point_id
  FROM coaching_points
  WHERE game_id = p_game_id
),
game_point_count AS (
  SELECT COUNT(*) AS total_points FROM game_points
),
views_by_player AS (
  SELECT
    eu.player_id,
    COUNT(DISTINCT cpvs.point_id)    AS points_viewed,
    COALESCE(SUM(cpvs.view_count),0) AS total_views,
    MIN(cpvs.first_viewed_at)        AS earliest_view,
    MAX(cpvs.last_viewed_at)         AS latest_view
  FROM effective_users eu
  JOIN coaching_point_view_summary cpvs ON cpvs.user_id = eu.user_id
  JOIN game_points gp ON gp.point_id = cpvs.point_id
  GROUP BY eu.player_id
),
max_per_point AS (
  SELECT
    eu.player_id,
    cpve.point_id,
    MAX(cpve.completion_percentage) AS point_max_completion
  FROM effective_users eu
  JOIN coaching_point_view_events cpve ON cpve.user_id = eu.user_id
  JOIN game_points gp ON gp.point_id = cpve.point_id
  GROUP BY eu.player_id, cpve.point_id
),
avg_of_point_maxes AS (
  SELECT
    player_id,
    AVG(point_max_completion)::numeric(5,2) AS avg_completion_percentage
  FROM max_per_point
  GROUP BY player_id
),
acknowledgments_by_player AS (
  SELECT
    cpa.player_id,
    COUNT(*) FILTER (WHERE cpa.acknowledged = true) AS points_ackd,
    COUNT(*) FILTER (WHERE cpa.acknowledged = true AND cpa.notes IS NOT NULL AND cpa.notes != '') AS points_note_written
  FROM coaching_point_acknowledgments cpa
  JOIN game_points gp ON gp.point_id = cpa.point_id
  GROUP BY cpa.player_id
)
SELECT
  bp.player_id,
  bp.player_name                                AS player_name,
  COALESCE(v.points_viewed, 0)                  AS points_viewed,
  COALESCE(v.total_views, 0)                    AS total_views,
  CASE
    WHEN gpc.total_points = 0 THEN 0
    ELSE (COALESCE(v.points_viewed,0)::decimal / gpc.total_points)
  END                                           AS view_percentage,
  COALESCE(a.avg_completion_percentage, 0)::decimal(5,2)/100 AS avg_completion_percentage,
  COALESCE(ack.points_ackd, 0)                  AS points_ackd,
  COALESCE(ack.points_note_written, 0)          AS points_note_written,
  v.earliest_view,
  v.latest_view
FROM base_players bp
CROSS JOIN game_point_count gpc
LEFT JOIN views_by_player v ON v.player_id = bp.player_id
LEFT JOIN avg_of_point_maxes a ON a.player_id = bp.player_id
LEFT JOIN acknowledgments_by_player ack ON ack.player_id = bp.player_id
ORDER BY points_viewed DESC, bp.player_name;
$$;
