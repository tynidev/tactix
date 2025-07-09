import { Request, Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase, supabaseAuth } from '../utils/supabase.js';

const router = Router();

// Helper function to join a team with service role permissions
async function joinTeamWithServiceRole(
  userId: string,
  joinCode: string,
): Promise<{ success: boolean; error?: string; teamInfo?: any; }>
{
  try
  {
    // Find active join code
    const { data: joinCodeData, error: findError } = await supabase
      .from('team_join_codes')
      .select(`
        team_id,
        team_role,
        is_active,
        expires_at,
        teams!inner(id, name)
      `)
      .eq('code', joinCode)
      .eq('is_active', true)
      .single();

    if (findError || !joinCodeData)
    {
      return { success: false, error: 'Invalid or inactive join code' };
    }

    // Check if code is expired
    if (joinCodeData.expires_at && new Date(joinCodeData.expires_at) < new Date())
    {
      return { success: false, error: 'Join code has expired' };
    }

    // Check if user is already a member of this team
    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from('team_memberships')
      .select('id, role')
      .eq('team_id', joinCodeData.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipCheckError && membershipCheckError.code !== 'PGRST116')
    { // PGRST116 = no rows found
      return { success: false, error: membershipCheckError.message };
    }

    if (existingMembership)
    {
      const teamInfo = Array.isArray(joinCodeData.teams) ? joinCodeData.teams[0] : joinCodeData.teams;
      return {
        success: true,
        teamInfo: {
          id: joinCodeData.team_id,
          name: teamInfo.name,
          role: existingMembership.role,
        },
      };
    }

    // Determine the role
    const roleToAssign = joinCodeData.team_role || 'player';

    // Get user's profile for potential player name
    let userProfile = null;
    if (roleToAssign === 'player')
    {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', userId)
        .single();

      if (!profileError && profile)
      {
        userProfile = profile;
      }
    }

    // Add user to team with the determined role
    const { error: joinError } = await supabase
      .from('team_memberships')
      .insert({
        team_id: joinCodeData.team_id,
        user_id: userId,
        role: roleToAssign,
      });

    if (joinError)
    {
      return { success: false, error: 'Failed to join team' };
    }

    // If user is joining as a player, create player profile
    if (roleToAssign === 'player')
    {
      const { data: playerProfile, error: playerError } = await supabase
        .from('player_profiles')
        .insert({
          name: userProfile?.name || 'Player',
          jersey_number: null,
          user_id: userId,
        })
        .select()
        .single();

      if (playerError)
      {
        // Rollback membership creation
        await supabase
          .from('team_memberships')
          .delete()
          .eq('team_id', joinCodeData.team_id)
          .eq('user_id', userId);

        return { success: false, error: 'Failed to create player profile' };
      }

      // Link player to team
      const { error: linkError } = await supabase
        .from('team_players')
        .insert({
          team_id: joinCodeData.team_id,
          player_id: playerProfile.id,
        });

      if (linkError)
      {
        // Rollback both membership and player profile creation
        await supabase
          .from('player_profiles')
          .delete()
          .eq('id', playerProfile.id);

        await supabase
          .from('team_memberships')
          .delete()
          .eq('team_id', joinCodeData.team_id)
          .eq('user_id', userId);

        return { success: false, error: 'Failed to link player to team' };
      }
    }

    const teamInfo = Array.isArray(joinCodeData.teams) ? joinCodeData.teams[0] : joinCodeData.teams;

    return {
      success: true,
      teamInfo: {
        id: joinCodeData.team_id,
        name: teamInfo.name,
        role: roleToAssign,
      },
    };
  }
  catch (error)
  {
    console.error('Join team with service role error:', error);
    return { success: false, error: 'Internal server error during team join' };
  }
}

// Sign up new user
router.post('/signup', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    const { email, password, name, teamCode } = req.body;

    if (!email || !password || !name)
    {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // Create user in Supabase Auth using signUp with anon key client
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (authError)
    {
      console.error('Supabase Auth Error:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        cause: authError.cause,
        stack: authError.stack,
      });
      res.status(400).json({ error: authError.message });
      return;
    }

    if (!authData.user)
    {
      res.status(400).json({ error: 'Failed to create user' });
      return;
    }

    // The trigger should have automatically created the user record in public.user_profiles
    // Let's verify it exists and retrieve it - use service role client for this
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError)
    {
      // Clean up auth user if we can't find the user record - use service role for admin operation
      await supabase.auth.admin.deleteUser(authData.user.id);
      res.status(400).json({ error: `Failed to retrieve user profile: ${userError.message}` });
      return;
    }

    const response: any = {
      message: 'User created successfully',
      user: userData,
    };

    // If a team code was provided, attempt to join the team
    if (teamCode && teamCode.trim())
    {
      const teamJoinResult = await joinTeamWithServiceRole(authData.user.id, teamCode.trim());

      if (teamJoinResult.success)
      {
        response.teamJoin = {
          success: true,
          message: `Successfully joined team "${teamJoinResult.teamInfo?.name}" as ${teamJoinResult.teamInfo?.role}`,
          team: teamJoinResult.teamInfo,
        };
      }
      else
      {
        response.teamJoin = {
          success: false,
          error: teamJoinResult.error,
        };
      }
    }

    res.status(201).json(response);
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get current user profile
router.get('/me', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { data: userData, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error)
    {
      res.status(404).json({
        error: 'User not found',
        details: {
          userId,
          message: error.message || String(error),
        },
      });
      return;
    }

    res.json(userData);
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    const { name } = req.body;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim())
    {
      res.status(400).json({ error: 'Name is required and must be a valid string' });
      return;
    }

    const { data: userData, error } = await supabase
      .from('user_profiles')
      .update({ name: name.trim() })
      .eq('id', userId)
      .select()
      .single();

    if (error)
    {
      res.status(400).json({
        error: 'Failed to update profile',
        details: error.message || String(error),
      });
      return;
    }

    res.json({
      message: 'Profile updated successfully',
      user: userData,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test Supabase connection
router.get('/test-connection', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    // Test if we can reach Supabase
    const { data, error } = await supabase.from('user_profiles').select('count').limit(1);

    if (error)
    {
      res.status(500).json({
        error: 'Supabase connection failed',
        details: error.message,
        supabaseUrl: process.env.SUPABASE_URL,
      });
      return;
    }

    res.json({
      message: 'Supabase connection successful',
      supabaseUrl: process.env.SUPABASE_URL,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Connection test failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Test Supabase Auth connection
router.get('/test-auth', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    // Try to get the current session (should be null if not logged in)
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error)
    {
      res.status(500).json({
        error: 'Supabase Auth test failed',
        details: error.message,
        errorObject: error,
      });
      return;
    }

    res.json({
      message: 'Supabase Auth connection successful',
      hasSession: !!session,
      supabaseUrl: process.env.SUPABASE_URL,
    });
  }
  catch (error)
  {
    res.status(500).json({
      error: 'Auth test failed',
      details: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name,
    });
  }
});

export default router;
