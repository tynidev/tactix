import { Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { TeamRole } from '../types/database.js';
import { requireTeamRole } from '../utils/roleAuth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// Join code generation constants
const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 100;

/**
 * Generates a unique join code by checking for collisions across all join code columns
 */
async function generateUniqueJoinCode(): Promise<string>
{
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++)
  {
    // Generate random code
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++)
    {
      code += SAFE_CHARS.charAt(Math.floor(Math.random() * SAFE_CHARS.length));
    }

    // Check if code exists in ANY of the join code columns
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .or(
        `coach_join_code.eq.${code},player_join_code.eq.${code},admin_join_code.eq.${code},parent_join_code.eq.${code}`,
      )
      .limit(1);

    if (error)
    {
      throw new Error(`Database error while checking join code uniqueness: ${error.message}`);
    }

    // If no matches found, code is unique
    if (!data || data.length === 0)
    {
      return code;
    }
  }

  throw new Error(`Failed to generate unique join code after ${MAX_ATTEMPTS} attempts`);
}

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

    // Generate unique join codes for each role
    const coachJoinCode = await generateUniqueJoinCode();
    const playerJoinCode = await generateUniqueJoinCode();
    const adminJoinCode = await generateUniqueJoinCode();
    const parentJoinCode = await generateUniqueJoinCode();

    // Create team with join codes
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        coach_join_code: coachJoinCode,
        player_join_code: playerJoinCode,
        admin_join_code: adminJoinCode,
        parent_join_code: parentJoinCode,
      })
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
          coach_join_code,
          player_join_code,
          admin_join_code,
          parent_join_code,
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

// Join team using join code
router.post('/join', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { joinCode } = req.body;
    const userId = req.user?.id;

    if (!joinCode)
    {
      res.status(400).json({ error: 'Join code is required' });
      return;
    }

    // Find team and determine role using the database function
    const { data: teamResults, error: findError } = await supabase
      .rpc('find_team_by_join_code', { join_code_input: joinCode });

    if (findError)
    {
      res.status(400).json({ error: findError.message });
      return;
    }

    if (!teamResults || teamResults.length === 0)
    {
      res.status(404).json({ error: 'Invalid join code' });
      return;
    }

    const { team_id, team_name, role_for_code } = teamResults[0];

    // Check if user is already a member of this team
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('team_memberships')
      .select('id, role')
      .eq('team_id', team_id)
      .eq('user_id', userId)
      .single();

    if (membershipCheckError && membershipCheckError.code !== 'PGRST116')
    { // PGRST116 = no rows found
      res.status(400).json({ error: membershipCheckError.message });
      return;
    }

    if (existingMembership)
    {
      res.status(409).json({
        error: `You are already a member of this team as a ${existingMembership.role}`,
      });
      return;
    }

    // Add user to team with the role determined by the join code
    const { error: joinError } = await supabase
      .from('team_memberships')
      .insert({
        team_id,
        user_id: userId!,
        role: role_for_code as TeamRole,
      });

    if (joinError)
    {
      res.status(400).json({ error: 'Failed to join team' });
      return;
    }

    res.status(200).json({
      message: `Successfully joined team "${team_name}" as ${role_for_code}`,
      team: {
        id: team_id,
        name: team_name,
        role: role_for_code,
      },
    });
  }
  catch (error)
  {
    console.error('Join team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
