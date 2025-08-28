import express, { Response } from 'express';
import { type AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

// GET /api/test/lookup-data - Get reference data for testing
router.get('/lookup-data', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get teams where user is coach/admin
    const { data: memberships, error: membershipError } = await supabase
      .from('team_memberships')
      .select('team_id, role')
      .eq('user_id', userId)
      .in('role', ['coach', 'admin']);

    if (membershipError)
    {
      res.status(400).json({ error: membershipError.message });
      return;
    }

    const teamIds = (memberships || []).map(m => m.team_id);

    if (teamIds.length === 0)
    {
      res.json({
        teams: [],
        games: [],
        players: [],
        coachingPoints: [],
        coaches: [],
      });
      return;
    }

    // Get teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    // Get games
    const { data: games } = await supabase
      .from('games')
      .select('id, team_id, opponent, date')
      .in('team_id', teamIds)
      .order('date', { ascending: false })
      .limit(20);

    // Get players from these teams
    const { data: teamPlayers } = await supabase
      .from('team_players')
      .select(`
        player_profiles!inner(
          id,
          name,
          user_id
        )
      `)
      .in('team_id', teamIds);

    const players = (teamPlayers || []).map(tp => ({
      id: tp.player_profiles.id,
      name: tp.player_profiles.name,
      hasUserAccount: !!tp.player_profiles.user_id,
    }));

    // Get coaching points
    const gameIds = (games || []).map(g => g.id);
    const { data: coachingPoints } = gameIds.length > 0 ?
      await supabase
        .from('coaching_points')
        .select('id, title, game_id, author_id, created_at')
        .in('game_id', gameIds)
        .order('created_at', { ascending: false })
        .limit(20) :
      { data: [] };

    // Get coaches (users who are coaches/admins)
    const { data: coaches } = await supabase
      .from('team_memberships')
      .select(`
        user_id,
        user_profiles!inner(
          id,
          name
        )
      `)
      .in('team_id', teamIds)
      .in('role', ['coach', 'admin']);

    const uniqueCoaches = Array.from(
      new Map((coaches || []).map(c => [c.user_id, {
        id: c.user_id,
        name: c.user_profiles.name,
      }])).values(),
    );

    res.json({
      teams: teams || [],
      games: (games || []).map(g => ({
        ...g,
        teamName: (teams || []).find(t => t.id === g.team_id)?.name || 'Unknown',
      })),
      players: players,
      coachingPoints: (coachingPoints || []).map(cp => ({
        ...cp,
        gameName: (games || []).find(g => g.id === cp.game_id)?.opponent || 'Unknown Game',
      })),
      coaches: uniqueCoaches,
    });
  }
  catch (error)
  {
    console.error('Error in GET /test/lookup-data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
