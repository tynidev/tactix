import express, { Response } from 'express';
import { authenticateUser, type AuthenticatedRequest } from '../middleware/auth.js';
import { supabase } from '../utils/supabase';

const router = express.Router();

// POST /api/coaching-point-tagged-players - Tag a player to a coaching point
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { point_id, player_id } = req.body;

    if (!point_id || !player_id) {
      res.status(400).json({ 
        message: 'Missing required fields: point_id, player_id' 
      });
      return;
    }

    // Verify the user has permission to tag players to this coaching point
    const { data: pointData, error: pointError } = await supabase
      .from('coaching_points')
      .select(`
        id,
        games!inner(
          teams!inner(
            id,
            team_memberships!inner(
              user_id,
              role
            )
          )
        )
      `)
      .eq('id', point_id)
      .eq('games.teams.team_memberships.user_id', userId)
      .single();

    if (pointError || !pointData) {
      res.status(404).json({ message: 'Coaching point not found or access denied' });
      return;
    }

    // Check if user is a coach or admin
    const userRole = pointData.games.teams.team_memberships[0]?.role;
    if (!userRole || !['coach', 'admin'].includes(userRole)) {
      res.status(403).json({ 
        message: 'Only coaches and admins can tag players to coaching points' 
      });
      return;
    }

    // Verify the player belongs to the same team
    const teamId = pointData.games.teams.id;
    const { data: playerData, error: playerError } = await supabase
      .from('team_players')
      .select('id')
      .eq('player_id', player_id)
      .eq('team_id', teamId)
      .single();

    if (playerError || !playerData) {
      res.status(404).json({ message: 'Player not found or does not belong to this team' });
      return;
    }

    // Tag the player to the coaching point
    const { data: tag, error } = await supabase
      .from('coaching_point_tagged_players')
      .insert({
        point_id,
        player_id,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        res.status(409).json({ message: 'Player already tagged to this coaching point' });
        return;
      }
      console.error('Error tagging player:', error);
      res.status(500).json({ message: 'Failed to tag player' });
      return;
    }

    res.status(201).json(tag);
  } catch (error) {
    console.error('Error in POST /coaching-point-tagged-players:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/coaching-point-tagged-players/:id - Remove a player tag
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { id } = req.params;

    // Get the tag and verify permissions
    const { data: tag, error: fetchError } = await supabase
      .from('coaching_point_tagged_players')
      .select(`
        *,
        coaching_points!inner(
          games!inner(
            teams!inner(
              team_memberships!inner(
                user_id,
                role
              )
            )
          )
        )
      `)
      .eq('id', id)
      .eq('coaching_points.games.teams.team_memberships.user_id', userId)
      .single();

    if (fetchError || !tag) {
      res.status(404).json({ message: 'Player tag not found or access denied' });
      return;
    }

    // Check if user is a coach or admin
    const userRole = tag.coaching_points.games.teams.team_memberships[0]?.role;
    if (!userRole || !['coach', 'admin'].includes(userRole)) {
      res.status(403).json({ 
        message: 'Only coaches and admins can remove player tags' 
      });
      return;
    }

    // Remove the tag
    const { error: deleteError } = await supabase
      .from('coaching_point_tagged_players')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error removing player tag:', deleteError);
      res.status(500).json({ message: 'Failed to remove player tag' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /coaching-point-tagged-players/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
