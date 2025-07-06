import express, { Response } from 'express';
import { authenticateUser, type AuthenticatedRequest } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

// POST /api/coaching-points - Create a new coaching point
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const {
      game_id,
      author_id,
      title,
      feedback,
      timestamp,
      audio_url = '',
      duration = 0,
    } = req.body;

    // Validate required fields
    if (!game_id || !title || !feedback || !timestamp) {
      res.status(400).json({ 
        message: 'Missing required fields: game_id, title, feedback, timestamp' 
      });
      return;
    }

    // Verify the user has permission to create coaching points for this game
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        teams!inner(
          id,
          team_memberships!inner(
            user_id,
            role
          )
        )
      `)
      .eq('id', game_id)
      .eq('teams.team_memberships.user_id', userId)
      .single();

    if (gameError || !gameData) {
      res.status(404).json({ message: 'Game not found or access denied' });
      return;
    }

    // Check if user is a coach or admin
    const userRole = gameData.teams.team_memberships[0]?.role;
    if (!userRole || !['coach', 'admin'].includes(userRole)) {
      res.status(403).json({ 
        message: 'Only coaches and admins can create coaching points' 
      });
      return;
    }

    // Create the coaching point
    const { data: coachingPoint, error } = await supabase
      .from('coaching_points')
      .insert({
        game_id,
        author_id: userId, // Use the authenticated user's ID
        title,
        feedback,
        timestamp,
        audio_url,
        duration,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating coaching point:', error);
      res.status(500).json({ message: 'Failed to create coaching point' });
      return;
    }

    res.status(201).json(coachingPoint);
  } catch (error) {
    console.error('Error in POST /coaching-points:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/coaching-points/game/:gameId - Get coaching points for a game
router.get('/game/:gameId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { gameId } = req.params;

    // Verify the user has access to this game
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        teams!inner(
          id,
          team_memberships!inner(
            user_id,
            role
          )
        )
      `)
      .eq('id', gameId)
      .eq('teams.team_memberships.user_id', userId)
      .single();

    if (gameError || !gameData) {
      res.status(404).json({ message: 'Game not found or access denied' });
      return;
    }

    // Get coaching points for this game
    const { data: coachingPoints, error } = await supabase
      .from('coaching_points')
      .select(`
        *,
        author:user_profiles!author_id(
          id,
          name,
          email
        ),
        coaching_point_tagged_players(
          id,
          player_profiles(
            id,
            name,
            jersey_number
          )
        ),
        coaching_point_labels(
          id,
          labels(
            id,
            name
          )
        )
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching coaching points:', error);
      res.status(500).json({ message: 'Failed to fetch coaching points' });
      return;
    }

    res.json(coachingPoints || []);
  } catch (error) {
    console.error('Error in GET /coaching-points/game/:gameId:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/coaching-points/:id - Delete a coaching point
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { id } = req.params;

    // Get the coaching point and verify permissions
    const { data: coachingPoint, error: fetchError } = await supabase
      .from('coaching_points')
      .select(`
        *,
        games!inner(
          teams!inner(
            team_memberships!inner(
              user_id,
              role
            )
          )
        )
      `)
      .eq('id', id)
      .eq('games.teams.team_memberships.user_id', userId)
      .single();

    if (fetchError || !coachingPoint) {
      res.status(404).json({ message: 'Coaching point not found or access denied' });
      return;
    }

    // Check if user is the author or has admin/coach privileges
    const userRole = coachingPoint.games.teams.team_memberships[0]?.role;
    const isAuthor = coachingPoint.author_id === userId;
    const hasPermission = isAuthor || ['coach', 'admin'].includes(userRole);

    if (!hasPermission) {
      res.status(403).json({ 
        message: 'Only the author, coaches, or admins can delete coaching points' 
      });
      return;
    }

    // Delete the coaching point (events and other related data will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('coaching_points')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting coaching point:', deleteError);
      res.status(500).json({ message: 'Failed to delete coaching point' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /coaching-points/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
