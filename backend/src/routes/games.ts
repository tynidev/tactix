import { Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { TeamRole } from '../types/database.js';
import { requireTeamRole } from '../utils/roleAuth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Create a new game for a team
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      team_id,
      opponent,
      date,
      location,
      video_id,
      team_score,
      opp_score,
      game_type,
      home_away,
      notes
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!team_id || !opponent || !date) {
      res.status(400).json({ error: 'Team ID, opponent, and date are required' });
      return;
    }

    // Check if user has coach or admin role in the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      res.status(403).json({ error: 'User is not a member of this team' });
      return;
    }

    if (!['coach', 'admin'].includes(membership.role)) {
      res.status(403).json({ error: 'Only coaches and admins can create games' });
      return;
    }

    // Extract YouTube video ID from URL if full URL is provided
    let processedVideoId = video_id;
    if (video_id && (video_id.includes('youtube.com') || video_id.includes('youtu.be'))) {
      const urlMatch = video_id.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (urlMatch) {
        processedVideoId = urlMatch[1];
      }
    }

    // Create the game
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert({
        team_id,
        opponent,
        date,
        location: location || null,
        video_id: processedVideoId || null,
        team_score: team_score || null,
        opp_score: opp_score || null,
        game_type: game_type || 'regular',
        home_away: home_away || 'home',
        notes: notes || null
      })
      .select()
      .single();

    if (gameError) {
      res.status(400).json({ error: gameError.message });
      return;
    }

    res.status(201).json({
      message: 'Game created successfully',
      game: gameData
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get games for a team
router.get('/team/:teamId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      res.status(403).json({ error: 'User is not a member of this team' });
      return;
    }

    // Get games for the team
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        opponent,
        date,
        location,
        video_id,
        team_score,
        opp_score,
        game_type,
        home_away,
        notes,
        created_at
      `)
      .eq('team_id', teamId)
      .order('date', { ascending: false });

    if (gamesError) {
      res.status(400).json({ error: gamesError.message });
      return;
    }

    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific game with coaching points count
router.get('/:gameId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get the game and verify user has access
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        team_id,
        opponent,
        date,
        location,
        video_id,
        team_score,
        opp_score,
        game_type,
        home_away,
        notes,
        created_at,
        teams!inner(id, name)
      `)
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get coaching points count for this game
    const { count: coachingPointsCount } = await supabase
      .from('coaching_points')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    res.json({
      ...game,
      coaching_points_count: coachingPointsCount || 0
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a game (coaches and admins only)
router.put('/:gameId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const {
      opponent,
      date,
      location,
      video_id,
      team_score,
      opp_score,
      game_type,
      home_away,
      notes
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get the game and verify permissions
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('team_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if user has coach or admin role in the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!['coach', 'admin'].includes(membership.role)) {
      res.status(403).json({ error: 'Only coaches and admins can update games' });
      return;
    }

    // Extract YouTube video ID from URL if full URL is provided
    let processedVideoId = video_id;
    if (video_id && (video_id.includes('youtube.com') || video_id.includes('youtu.be'))) {
      const urlMatch = video_id.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (urlMatch) {
        processedVideoId = urlMatch[1];
      }
    }

    // Update the game
    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update({
        opponent,
        date,
        location: location || null,
        video_id: processedVideoId || null,
        team_score: team_score || null,
        opp_score: opp_score || null,
        game_type: game_type || 'regular',
        home_away: home_away || 'home',
        notes: notes || null
      })
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    res.json({
      message: 'Game updated successfully',
      game: updatedGame
    });
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a game (coaches and admins only)
router.delete('/:gameId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get the game and verify permissions
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('team_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if user has coach or admin role in the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!['coach', 'admin'].includes(membership.role)) {
      res.status(403).json({ error: 'Only coaches and admins can delete games' });
      return;
    }

    // Delete the game (coaching points will be deleted by cascade)
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (deleteError) {
      res.status(400).json({ error: deleteError.message });
      return;
    }

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
