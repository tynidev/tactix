import { Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { TeamRole } from '../types/database.js';
import { requireTeamRole } from '../utils/roleAuth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Create a new team
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { name } = req.body;
    const userId = req.user?.id;

    if (!name)
    {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    // Create team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single();

    if (teamError)
    {
      res.status(400).json({ error: teamError.message });
      return;
    }
    // Add creator as coach
    const { error: membershipError } = await supabase
      .from('team_memberships')
      .insert({
        team_id: teamData.id,
        user_id: userId!,
        role: TeamRole.Coach,
      });

    if (membershipError)
    {
      res.status(400).json({ error: 'Failed to add user to team' });
      return;
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
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
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
      res.status(400).json({ error: error.message });
      return;
    }

    res.json(teams);
  }
  catch (error)
  {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Update team - require coach or admin role
router.put(
  '/:teamId',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const { name } = req.body;

      const { data: teamData, error: updateError } = await supabase
        .from('teams')
        .update({ name })
        .eq('id', teamId)
        .select()
        .single();

      if (updateError)
      {
        res.status(400).json({ error: updateError.message });
        return;
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
  },
);

export default router;
