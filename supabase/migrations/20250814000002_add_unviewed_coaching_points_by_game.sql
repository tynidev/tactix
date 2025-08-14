-- Get unviewed coaching points for a specific game and user
CREATE OR REPLACE FUNCTION public.get_unviewed_coaching_points_for_game(
  p_user_id UUID,
  p_game_id UUID
)
RETURNS TABLE (
  id UUID,
  game_id UUID,
  title TEXT,
  feedback TEXT,
  "timestamp" INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.game_id,
    cp.title,
    cp.feedback,
    cp."timestamp",
    cp.created_at
  FROM public.coaching_points cp
  WHERE cp.game_id = p_game_id
    AND NOT EXISTS (
      SELECT 1 FROM public.coaching_point_view_summary vs
      WHERE vs.point_id = cp.id
        AND vs.user_id = p_user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.games g
      JOIN public.team_memberships tm ON g.team_id = tm.team_id
      WHERE g.id = cp.game_id
        AND tm.user_id = p_user_id
    )
  ORDER BY cp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_unviewed_coaching_points_for_game(UUID, UUID) TO authenticated;