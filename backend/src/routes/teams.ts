import { Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Create a new team
router.post('/', async (req: AuthenticatedRequest, res) =>
{
  try
  {
    const { name } = req.body;
    const userId = req.user?.id;

    if (!name)
    {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Create team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single();

    if (teamError)
    {
      return res.status(400).json({ error: teamError.message });
    }

    // Add creator as coach
    const { error: membershipError } = await supabase
      .from('team_memberships')
      .insert({
        team_id: teamData.id,
        user_id: userId!,
        role: 'coach',
      });

    if (membershipError)
    {
      return res.status(400).json({ error: 'Failed to add user to team' });
    }

    res.status(201).json({
      message: 'Team created successfully',
      team: teamData,
    });
  }
  catch (error)
  {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's teams
router.get('/', async (req: AuthenticatedRequest, res) =>
{
  try
  {
    const userId = req.user?.id;

    const { data: teams, error } = await supabase
      .from('team_memberships')
      .select(`
        role,
        teams (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error)
    {
      return res.status(400).json({ error: error.message });
    }

    res.json(teams);
  }
  catch (error)
  {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update team
router.put('/:teamId', async (req: AuthenticatedRequest, res) =>
{
  try
  {
    const { teamId } = req.params;
    const { name } = req.body;
    const userId = req.user?.id;

    // Check if user is coach or admin of this team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || !['coach', 'admin'].includes(membership.role))
    {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { data: teamData, error: updateError } = await supabase
      .from('teams')
      .update({ name })
      .eq('id', teamId)
      .select()
      .single();

    if (updateError)
    {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({
      message: 'Team updated successfully',
      team: teamData,
    });
  }
  catch (error)
  {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
