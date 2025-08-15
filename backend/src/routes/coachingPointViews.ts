import { Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { Database } from '../types/database.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// Record a view for a coaching point
router.post(
  '/coaching-points/:id/view',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { id: pointId } = req.params;
      const { completionPercentage = 0 } = req.body;
      const userId = req.user!.id;

      // Validate completion percentage
      if (completionPercentage < 0 || completionPercentage > 100)
      {
        res.status(400).json({ error: 'Completion percentage must be between 0 and 100' });
        return;
      }

      // Create a new view event
      const { data: viewEvent, error: viewEventError } = await supabase
        .from('coaching_point_view_events')
        .insert({
          point_id: pointId,
          user_id: userId,
          completion_percentage: completionPercentage,
        })
        .select()
        .single();

      if (viewEventError)
      {
        console.error('Error creating view event:', viewEventError);
        res.status(500).json({ error: 'Failed to record view' });
        return;
      }

      // Get the current view count for this user/point combination
      const { data: summary, error: summaryError } = await supabase
        .from('coaching_point_view_summary')
        .select('view_count')
        .eq('point_id', pointId)
        .eq('user_id', userId)
        .single();

      if (summaryError && summaryError.code !== 'PGRST116')
      { // PGRST116 = not found
        console.error('Error fetching view summary:', summaryError);
        res.status(500).json({ error: 'Failed to fetch view summary' });
        return;
      }

      const viewCount = summary?.view_count || 1;

      res.json({
        eventId: viewEvent.id,
        viewCount,
      });
      return;
    }
    catch (error)
    {
      console.error('Error in record view:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  },
);

// Update a view event (for completion percentage)
router.patch(
  '/coaching-points/view-events/:eventId',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { eventId } = req.params;
      const { completionPercentage } = req.body;
      const userId = req.user!.id;

      if (completionPercentage === undefined || completionPercentage < 0 || completionPercentage > 100)
      {
        res.status(400).json({ error: 'Invalid completion percentage' });
        return;
      }

      // Verify the view event belongs to the current user
      const { data: existingEvent, error: fetchError } = await supabase
        .from('coaching_point_view_events')
        .select('user_id')
        .eq('id', eventId)
        .single();

      if (fetchError || !existingEvent)
      {
        res.status(404).json({ error: 'View event not found' });
        return;
      }

      if (existingEvent.user_id !== userId)
      {
        res.status(403).json({ error: 'Unauthorized to update this view event' });
        return;
      }

      // Update the completion percentage
      const { data: updatedEvent, error: updateError } = await supabase
        .from('coaching_point_view_events')
        .update({ completion_percentage: completionPercentage })
        .eq('id', eventId)
        .select()
        .single();

      if (updateError)
      {
        console.error('Error updating view event:', updateError);
        res.status(500).json({ error: 'Failed to update view event' });
        return;
      }

      res.json(updatedEvent);
      return;
    }
    catch (error)
    {
      console.error('Error in update view event:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  },
);

// Get unviewed coaching points for the current user
router.get(
  '/coaching-points/unviewed',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const userId = req.user!.id;
      const gameId = req.query.gameId as string | undefined;

      // If a gameId is provided, call the filtered RPC
      if (gameId)
      {
        const { data: unviewedPoints, error } = await supabase
          .rpc('get_unviewed_coaching_points_for_game', { p_user_id: userId, p_game_id: gameId });

        if (error)
        {
          console.error('Error fetching unviewed points by game:', error);
          res.status(500).json({ error: 'Failed to fetch unviewed coaching points for game' });
          return;
        }

        res.json(unviewedPoints || []);
        return;
      }

      // Otherwise, return all unviewed points across teams the user belongs to
      const { data: unviewedPoints, error } = await supabase
        .rpc('get_unviewed_coaching_points', { p_user_id: userId });

      if (error)
      {
        console.error('Error fetching unviewed points:', error);
        res.status(500).json({ error: 'Failed to fetch unviewed coaching points' });
        return;
      }

      res.json(unviewedPoints || []);
      return;
    }
    catch (error)
    {
      console.error('Error in get unviewed:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  },
);

// Alias: Get unviewed coaching points for a specific game (coaches/players in that team)
// Useful for a more RESTful URL shape
router.get(
  '/games/:gameId/coaching-points/unviewed',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const userId = req.user!.id;
      const { gameId } = req.params;

      const { data: unviewedPoints, error } = await supabase
        .rpc('get_unviewed_coaching_points_for_game', { p_user_id: userId, p_game_id: gameId });

      if (error)
      {
        console.error('Error fetching unviewed points by game:', error);
        res.status(500).json({ error: 'Failed to fetch unviewed coaching points for game' });
        return;
      }

      res.json(unviewedPoints || []);
      return;
    }
    catch (error)
    {
      console.error('Error in get unviewed by game:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  },
);

// Get view analytics for a team (coaches only)
router.get(
  '/teams/:teamId/view-analytics',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const userId = req.user!.id;

      // Check if user is a coach for this team
      const { data: membership, error: membershipError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (membershipError || !membership || (membership.role !== 'coach' && membership.role !== 'admin'))
      {
        res.status(403).json({ error: 'Only coaches and admins can view analytics' });
        return;
      }

      // Get all coaching points for the team with view analytics
      const { data: coachingPoints, error: pointsError } = await supabase
        .from('coaching_points')
        .select(`
        id,
        title,
        timestamp,
        games!inner(team_id)
      `)
        .eq('games.team_id', teamId);

      if (pointsError)
      {
        console.error('Error fetching coaching points:', pointsError);
        res.status(500).json({ error: 'Failed to fetch coaching points' });
        return;
      }

      if (!coachingPoints || coachingPoints.length === 0)
      {
        res.json([]);
        return;
      }

      // Get view analytics for each coaching point
      const analytics = await Promise.all(coachingPoints.map(async (point) =>
      {
        // Get unique viewers count
        const { count: uniqueViewers, error: viewersError } = await supabase
          .from('coaching_point_view_summary')
          .select('*', { count: 'exact', head: true })
          .eq('point_id', point.id);

        if (viewersError)
        {
          console.error('Error counting unique viewers:', viewersError);
        }

        // Get total views and completion stats
        const { data: viewEvents, error: eventsError } = await supabase
          .from('coaching_point_view_events')
          .select('completion_percentage')
          .eq('point_id', point.id);

        if (eventsError)
        {
          console.error('Error fetching view events:', eventsError);
        }

        // Calculate view metrics:
        // - totalViews = Total number of view events
        // - completedViews = Number of views where user watched more than 80% of the content (considered "completed")
        // - avgCompletion = Average completion percentage across all views
        const totalViews = viewEvents?.length || 0;
        const completedViews = viewEvents?.filter(e =>
          typeof e.completion_percentage === 'number' && e.completion_percentage > 80
        ).length || 0;
        const avgCompletion = totalViews > 0 ?
          Math.round(viewEvents!.reduce((sum, e) => sum + (e.completion_percentage || 0), 0) / totalViews) :
          0;

        return {
          id: point.id,
          title: point.title,
          timestamp: point.timestamp,
          uniqueViewers: uniqueViewers || 0,
          totalViews, // Total number of view events
          avgCompletion, // Average completion percentage across all views
          completedViews, // Number of views where user watched more than 80% of the content (considered "completed")
        };
      }));

      res.json(analytics);
      return;
    }
    catch (error)
    {
      console.error('Error in get analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  },
);

export default router;

/*
API Documentation:

POST /coaching-points/:id/view
- Records a view event for a coaching point
- Body: { completionPercentage?: number (0-100) }
- Returns: { eventId: string, viewCount: number }

PATCH /coaching-points/view-events/:eventId
- Updates the completion percentage for a view event
- Body: { completionPercentage: number (0-100) }
- Returns: Updated view event

GET /coaching-points/unviewed
- Gets unviewed coaching points for the current user
- Optional query: ?gameId=<uuid> to limit to a specific game
- Returns: Array of coaching points that haven't been viewed

GET /games/:gameId/coaching-points/unviewed
- Equivalent to GET /coaching-points/unviewed?gameId=<uuid>
- Returns: Array of coaching points for that game the user hasn't viewed

GET /teams/:teamId/view-analytics
- Gets view analytics for all coaching points in a team (coaches only)
- Returns: Array of analytics data including:
  - id: coaching point id
  - title: coaching point title
  - timestamp: video timestamp
  - uniqueViewers: number of unique viewers
  - totalViews: total view count
  - avgCompletion: average completion percentage
  - completedViews: number of views with >80% completion
*/
