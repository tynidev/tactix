import express, { Response } from 'express';
import { type AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

// POST /api/coaching-point-labels - Assign a label to a coaching point
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { point_id, label_id } = req.body;

    if (!point_id || !label_id)
    {
      res.status(400).json({
        message: 'Missing required fields: point_id, label_id',
      });
      return;
    }

    // Verify the user has permission to assign labels to this coaching point
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

    if (pointError || !pointData)
    {
      res.status(404).json({ message: 'Coaching point not found or access denied' });
      return;
    }

    // Check if user is a coach or admin
    const userRole = pointData.games.teams.team_memberships[0]?.role;
    if (!userRole || !['coach', 'admin'].includes(userRole))
    {
      res.status(403).json({
        message: 'Only coaches and admins can assign labels to coaching points',
      });
      return;
    }

    // Verify the label belongs to the same team
    const teamId = pointData.games.teams.id;
    const { data: labelData, error: labelError } = await supabase
      .from('labels')
      .select('id')
      .eq('id', label_id)
      .eq('team_id', teamId)
      .single();

    if (labelError || !labelData)
    {
      res.status(404).json({ message: 'Label not found or does not belong to this team' });
      return;
    }

    // Assign the label to the coaching point
    const { data: assignment, error } = await supabase
      .from('coaching_point_labels')
      .insert({
        point_id,
        label_id,
      })
      .select('*')
      .single();

    if (error)
    {
      if (error.code === '23505')
      { // Unique constraint violation
        res.status(409).json({ message: 'Label already assigned to this coaching point' });
        return;
      }
      console.error('Error assigning label:', error);
      res.status(500).json({ message: 'Failed to assign label' });
      return;
    }

    res.status(201).json(assignment);
  }
  catch (error)
  {
    console.error('Error in POST /coaching-point-labels:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/coaching-point-labels/:id - Remove a label assignment
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { id } = req.params;

    // Get the assignment and verify permissions
    const { data: assignment, error: fetchError } = await supabase
      .from('coaching_point_labels')
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

    if (fetchError || !assignment)
    {
      res.status(404).json({ message: 'Label assignment not found or access denied' });
      return;
    }

    // Check if user is a coach or admin
    const userRole = assignment.coaching_points.games.teams.team_memberships[0]?.role;
    if (!userRole || !['coach', 'admin'].includes(userRole))
    {
      res.status(403).json({
        message: 'Only coaches and admins can remove label assignments',
      });
      return;
    }

    // Remove the assignment
    const { error: deleteError } = await supabase
      .from('coaching_point_labels')
      .delete()
      .eq('id', id);

    if (deleteError)
    {
      console.error('Error removing label assignment:', deleteError);
      res.status(500).json({ message: 'Failed to remove label assignment' });
      return;
    }

    res.status(204).send();
  }
  catch (error)
  {
    console.error('Error in DELETE /coaching-point-labels/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
