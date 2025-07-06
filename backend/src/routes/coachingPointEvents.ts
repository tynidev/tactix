 import express, { Response } from 'express';
import { authenticateUser, type AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../utils/supabase';

const router = express.Router();

// POST /api/coaching-point-events - Create a new coaching point event
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const {
      point_id,
      event_type,
      timestamp,
      event_data,
    } = req.body;

    // Validate required fields
    if (!point_id || !event_type || timestamp === undefined || !event_data) {
      res.status(400).json({ 
        message: 'Missing required fields: point_id, event_type, timestamp, event_data' 
      });
      return;
    }

    // Verify the user has permission to add events to this coaching point
    const { data: coachingPoint, error: pointError } = await supabase
      .from('coaching_points')
      .select(`
        id,
        author_id,
        games!inner(
          teams!inner(
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

    if (pointError || !coachingPoint) {
      res.status(404).json({ message: 'Coaching point not found or access denied' });
      return;
    }

    // Check if user has permission (author, coach, or admin)
    const userRole = coachingPoint.games.teams.team_memberships[0]?.role;
    const isAuthor = coachingPoint.author_id === userId;
    const hasPermission = isAuthor || ['coach', 'admin'].includes(userRole);

    if (!hasPermission) {
      res.status(403).json({ 
        message: 'Only the author, coaches, or admins can add events to coaching points' 
      });
      return;
    }

    // Create the coaching point event
    const { data: event, error } = await supabase
      .from('coaching_point_events')
      .insert({
        point_id,
        event_type,
        timestamp,
        event_data,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating coaching point event:', error);
      res.status(500).json({ message: 'Failed to create coaching point event' });
      return;
    }

    res.status(201).json(event);
  } catch (error) {
    console.error('Error in POST /coaching-point-events:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/coaching-point-events/point/:pointId - Get events for a coaching point
router.get('/point/:pointId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { pointId } = req.params;

    // Verify the user has access to this coaching point
    const { data: coachingPoint, error: pointError } = await supabase
      .from('coaching_points')
      .select(`
        id,
        games!inner(
          teams!inner(
            team_memberships!inner(
              user_id,
              role
            )
          )
        )
      `)
      .eq('id', pointId)
      .eq('games.teams.team_memberships.user_id', userId)
      .single();

    if (pointError || !coachingPoint) {
      res.status(404).json({ message: 'Coaching point not found or access denied' });
      return;
    }

    // Get events for this coaching point
    const { data: events, error } = await supabase
      .from('coaching_point_events')
      .select('*')
      .eq('point_id', pointId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching coaching point events:', error);
      res.status(500).json({ message: 'Failed to fetch coaching point events' });
      return;
    }

    res.json(events || []);
  } catch (error) {
    console.error('Error in GET /coaching-point-events/point/:pointId:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/coaching-point-events/:id - Delete a coaching point event
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { id } = req.params;

    // Get the event and verify permissions
    const { data: event, error: fetchError } = await supabase
      .from('coaching_point_events')
      .select(`
        *,
        coaching_points!inner(
          author_id,
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

    if (fetchError || !event) {
      res.status(404).json({ message: 'Coaching point event not found or access denied' });
      return;
    }

    // Check if user has permission (author, coach, or admin)
    const userRole = event.coaching_points.games.teams.team_memberships[0]?.role;
    const isAuthor = event.coaching_points.author_id === userId;
    const hasPermission = isAuthor || ['coach', 'admin'].includes(userRole);

    if (!hasPermission) {
      res.status(403).json({ 
        message: 'Only the author, coaches, or admins can delete coaching point events' 
      });
      return;
    }

    // Delete the event
    const { error: deleteError } = await supabase
      .from('coaching_point_events')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting coaching point event:', deleteError);
      res.status(500).json({ message: 'Failed to delete coaching point event' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /coaching-point-events/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
