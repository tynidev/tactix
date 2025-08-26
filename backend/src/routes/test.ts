import express, { Response } from 'express';
import { type AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

/**
 * Options for filtering views in getViewsWithGuardianSupport
 */
interface ViewsQueryOptions {
  teamId?: string;
  playerId?: string;
  startDate?: string;
  endDate?: string;
  coachingPointId?: string;
  gameId?: string;
  coachId?: string;
}

/**
 * Comprehensive function to get views by any combination of filters.
 * Handles both direct player views (when player has user_profile) and 
 * guardian views (when player doesn't have user_profile).
 */
async function getViewsWithGuardianSupport(options: ViewsQueryOptions): Promise<Array<{
  player_profile_id: string;
  player_name: string;
  point_id: string;
  point_title: string;
  game_id: string;
  team_id: string;
  completion_percentage: number | null;
  created_at: string;
  view_source: 'direct' | 'guardian';
  guardian_id?: string;
}>> {
  // Build dynamic WHERE clauses based on provided options
  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Helper to add parameterized condition
  const addCondition = (condition: string, value: any) => {
    whereConditions.push(`${condition} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  };

  // Helper to add date range condition
  const addDateRange = (field: string) => {
    if (options.startDate) {
      whereConditions.push(`${field} >= $${paramIndex}`);
      params.push(options.startDate);
      paramIndex++;
    }
    if (options.endDate) {
      whereConditions.push(`${field} <= $${paramIndex}`);
      params.push(options.endDate);
      paramIndex++;
    }
  };

  // Build filter conditions
  if (options.teamId) addCondition('g.team_id', options.teamId);
  if (options.playerId) addCondition('pp.id', options.playerId);
  if (options.coachingPointId) addCondition('cp.id', options.coachingPointId);
  if (options.gameId) addCondition('g.id', options.gameId);
  if (options.coachId) addCondition('cp.author_id', options.coachId);
  
  // Add date range for view events
  addDateRange('cpve.created_at');

  try {
    // Since we need complex filtering, we'll break this into parts using standard Supabase queries
    
    // Step 1: Build base query conditions for coaching_point_view_events
    let viewQuery = supabase
      .from('coaching_point_view_events')
      .select(`
        point_id,
        user_id,
        completion_percentage,
        created_at,
        coaching_points!inner(
          id,
          title,
          games!inner(
            id,
            team_id
          )
        )
      `);

    // Apply filters
    if (options.coachingPointId) {
      viewQuery = viewQuery.eq('point_id', options.coachingPointId);
    }
    if (options.startDate) {
      viewQuery = viewQuery.gte('created_at', options.startDate);
    }
    if (options.endDate) {
      viewQuery = viewQuery.lte('created_at', options.endDate);
    }
    if (options.teamId) {
      viewQuery = viewQuery.eq('coaching_points.games.team_id', options.teamId);
    }
    if (options.gameId) {
      viewQuery = viewQuery.eq('coaching_points.games.id', options.gameId);
    }
    if (options.coachId) {
      viewQuery = viewQuery.eq('coaching_points.author_id', options.coachId);
    }

    const { data: viewEvents, error: viewError } = await viewQuery;

    if (viewError) {
      console.error('Error fetching view events:', viewError);
      throw viewError;
    }

    if (!viewEvents || viewEvents.length === 0) {
      return [];
    }

    // Step 2: Get player profiles to determine which views are direct vs guardian
    // Filter players to only those on relevant teams based on the query options
    let relevantTeamIds: string[] = [];
    
    // Determine which teams are relevant based on the filters
    if (options.teamId) {
      relevantTeamIds = [options.teamId];
    } else if (options.gameId) {
      // Get team from the game
      const gameTeam = (viewEvents || []).find(event => {
        const game = event.coaching_points?.games;
        return game?.id === options.gameId;
      });
      if (gameTeam?.coaching_points?.games?.team_id) {
        relevantTeamIds = [gameTeam.coaching_points.games.team_id];
      }
    } else if (options.coachId) {
      // Get teams where the coach has coach/admin role
      const { data: coachTeams, error: coachTeamsError } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('user_id', options.coachId)
        .in('role', ['coach', 'admin']);
        
      if (coachTeamsError) {
        console.error('Error fetching coach teams:', coachTeamsError);
        throw coachTeamsError;
      }
      
      relevantTeamIds = (coachTeams || []).map(t => t.team_id);
    } else {
      // Extract unique team IDs from view events if no specific team filter
      const teamIdSet = new Set<string>();
      (viewEvents || []).forEach(event => {
        const teamId = event.coaching_points?.games?.team_id;
        if (teamId) teamIdSet.add(teamId);
      });
      relevantTeamIds = Array.from(teamIdSet);
    }

    let playerQuery = supabase
      .from('player_profiles')
      .select(`
        id, 
        name, 
        user_id,
        team_players!inner(team_id)
      `);

    // Filter by specific player if provided
    if (options.playerId) {
      playerQuery = playerQuery.eq('id', options.playerId);
    }
    
    // Filter players to only those on relevant teams
    if (relevantTeamIds.length > 0) {
      playerQuery = playerQuery.in('team_players.team_id', relevantTeamIds);
    }

    const { data: playerProfiles, error: playerError } = await playerQuery;

    if (playerError) {
      console.error('Error fetching player profiles:', playerError);
      throw playerError;
    }

    // Step 3: Get guardian relationships for players without user accounts
    // Only get players that are already filtered by team membership
    const playersWithoutUser = (playerProfiles || []).filter(p => !p.user_id);
    let guardianMap = new Map<string, string[]>();

    if (playersWithoutUser.length > 0) {
      const { data: guardianRels, error: guardianError } = await supabase
        .from('guardian_player_relationships')
        .select('guardian_id, player_profile_id')
        .in('player_profile_id', playersWithoutUser.map(p => p.id));

      if (guardianError) {
        console.error('Error fetching guardian relationships:', guardianError);
        throw guardianError;
      }

      (guardianRels || []).forEach(rel => {
        const existing = guardianMap.get(rel.player_profile_id) || [];
        existing.push(rel.guardian_id);
        guardianMap.set(rel.player_profile_id, existing);
      });
    }

    // Step 4: Process and categorize view events
    const result: Array<{
      player_profile_id: string;
      player_name: string;
      point_id: string;
      point_title: string;
      game_id: string;
      team_id: string;
      completion_percentage: number | null;
      created_at: string;
      view_source: 'direct' | 'guardian';
      guardian_id?: string;
    }> = [];

    (viewEvents || []).forEach(event => {
      const point = event.coaching_points;
      const game = point.games;

      // Check if this is a direct player view
      const directPlayer = (playerProfiles || []).find(p => p.user_id === event.user_id);
      if (directPlayer) {
        result.push({
          player_profile_id: directPlayer.id,
          player_name: directPlayer.name,
          point_id: event.point_id,
          point_title: point.title,
          game_id: game.id,
          team_id: game.team_id,
          completion_percentage: event.completion_percentage,
          created_at: event.created_at,
          view_source: 'direct'
        });
        return;
      }

      // Check if this is a guardian view
      for (const [playerId, guardianIds] of guardianMap.entries()) {
        if (guardianIds.includes(event.user_id)) {
          const player = playersWithoutUser.find(p => p.id === playerId);
          if (player) {
            result.push({
              player_profile_id: player.id,
              player_name: player.name,
              point_id: event.point_id,
              point_title: point.title,
              game_id: game.id,
              team_id: game.team_id,
              completion_percentage: event.completion_percentage,
              created_at: event.created_at,
              view_source: 'guardian',
              guardian_id: event.user_id
            });
          }
          break;
        }
      }
    });

    // Sort by players with the most views (group by player and count views)
    const playerViewCounts = new Map<string, number>();
    result.forEach(view => {
      const currentCount = playerViewCounts.get(view.player_profile_id) || 0;
      playerViewCounts.set(view.player_profile_id, currentCount + 1);
    });

    // Sort result by player view count (descending), then by player name, then by created_at
    return result.sort((a, b) => {
      const aViewCount = playerViewCounts.get(a.player_profile_id) || 0;
      const bViewCount = playerViewCounts.get(b.player_profile_id) || 0;
      
      // First, sort by view count (descending)
      if (aViewCount !== bViewCount) {
        return bViewCount - aViewCount;
      }
      
      // Then by player name (ascending)
      if (a.player_name !== b.player_name) {
        return a.player_name.localeCompare(b.player_name);
      }
      
      // Finally by created_at (descending - most recent first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } catch (error) {
    console.error('Error in getViewsWithGuardianSupport:', error);
    throw error;
  }
}

// POST /api/test/guardian-views - Test the getViewsWithGuardianSupport function
router.post('/guardian-views', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Extract test parameters from request body
    const {
      teamId,
      playerId,
      startDate,
      endDate,
      coachingPointId,
      gameId,
      coachId
    } = req.body;

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      res.status(400).json({ error: 'Invalid startDate format. Use ISO string format.' });
      return;
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      res.status(400).json({ error: 'Invalid endDate format. Use ISO string format.' });
      return;
    }

    const options: ViewsQueryOptions = {};
    if (teamId) options.teamId = teamId;
    if (playerId) options.playerId = playerId;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (coachingPointId) options.coachingPointId = coachingPointId;
    if (gameId) options.gameId = gameId;
    if (coachId) options.coachId = coachId;

    console.log('Testing getViewsWithGuardianSupport with options:', options);
    
    const result = await getViewsWithGuardianSupport(options);
    
    res.json({
      success: true,
      options: options,
      resultCount: result.length,
      results: result,
      summary: {
        directViews: result.filter(r => r.view_source === 'direct').length,
        guardianViews: result.filter(r => r.view_source === 'guardian').length,
        uniquePlayers: new Set(result.map(r => r.player_profile_id)).size,
        uniquePoints: new Set(result.map(r => r.point_id)).size,
        uniqueGames: new Set(result.map(r => r.game_id)).size,
        uniqueTeams: new Set(result.map(r => r.team_id)).size
      }
    });
  } catch (error) {
    console.error('Error in POST /test/guardian-views:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/test/lookup-data - Get reference data for testing
router.get('/lookup-data', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get teams where user is coach/admin
    const { data: memberships, error: membershipError } = await supabase
      .from('team_memberships')
      .select('team_id, role')
      .eq('user_id', userId)
      .in('role', ['coach', 'admin']);

    if (membershipError) {
      res.status(400).json({ error: membershipError.message });
      return;
    }

    const teamIds = (memberships || []).map(m => m.team_id);
    
    if (teamIds.length === 0) {
      res.json({
        teams: [],
        games: [],
        players: [],
        coachingPoints: [],
        coaches: []
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
      hasUserAccount: !!tp.player_profiles.user_id
    }));

    // Get coaching points
    const gameIds = (games || []).map(g => g.id);
    const { data: coachingPoints } = gameIds.length > 0 ? await supabase
      .from('coaching_points')
      .select('id, title, game_id, author_id, created_at')
      .in('game_id', gameIds)
      .order('created_at', { ascending: false })
      .limit(20) : { data: [] };

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
        name: c.user_profiles.name
      }])).values()
    );

    res.json({
      teams: teams || [],
      games: (games || []).map(g => ({
        ...g,
        teamName: (teams || []).find(t => t.id === g.team_id)?.name || 'Unknown'
      })),
      players: players,
      coachingPoints: (coachingPoints || []).map(cp => ({
        ...cp,
        gameName: (games || []).find(g => g.id === cp.game_id)?.opponent || 'Unknown Game'
      })),
      coaches: uniqueCoaches
    });
  } catch (error) {
    console.error('Error in GET /test/lookup-data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
