import { Request, Response, Router } from 'express';
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
 * Generates a unique join code by checking the team_join_codes table
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

    // Check if code exists in team_join_codes table
    const { data, error } = await supabase
      .from('team_join_codes')
      .select('id')
      .eq('code', code)
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

// Validate join code (public endpoint - must be before auth middleware)
router.get('/join-codes/:code/validate', async (req: Request, res: Response): Promise<void> =>
{
  try
  {
    const { code } = req.params;

    if (!code)
    {
      res.status(400).json({ error: `Join code is required: ${code}` });
      return;
    }

    const filteredCode = code.toUpperCase().trim();

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
      .eq('code', filteredCode)
      .eq('is_active', true)
      .single();

    if (findError || !joinCodeData)
    {
      console.error(findError);
      res.status(404).json({ error: `Invalid or inactive join code (${filteredCode}): ${findError.message}` });
      return;
    }

    // Check if code is expired
    if (joinCodeData.expires_at && new Date(joinCodeData.expires_at) < new Date())
    {
      res.status(400).json({ error: `Join code (${filteredCode}) has expired at ${joinCodeData.expires_at}` });
      return;
    }

    const teamInfo = Array.isArray(joinCodeData.teams) ? joinCodeData.teams[0] : joinCodeData.teams;

    res.json({
      team_name: teamInfo.name,
      team_role: joinCodeData.team_role,
      team_id: joinCodeData.team_id,
    });
  }
  catch (error)
  {
    console.error('Validate join code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All routes below require authentication
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
      .insert({
        name,
        created_by: userId,
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

    // Create permanent join codes for all roles
    const joinCodes = {
      player: await generateUniqueJoinCode(),
      coach: await generateUniqueJoinCode(),
      admin: await generateUniqueJoinCode(),
      guardian: await generateUniqueJoinCode(),
    };

    const joinCodeInserts = Object.entries(joinCodes).map(([role, code]) => ({
      team_id: teamData.id,
      code,
      created_by: userId!,
      team_role: role as TeamRole,
      expires_at: null, // Never expires
      is_active: true,
    }));

    const { error: joinCodeError } = await supabase
      .from('team_join_codes')
      .insert(joinCodeInserts);

    if (joinCodeError)
    {
      console.error('Failed to create join codes:', joinCodeError);
      // Don't fail team creation if join codes fail
    }

    res.status(201).json({
      message: 'Team created successfully',
      team: {
        ...teamData,
        join_codes: joinCodes,
      },
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

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

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

    // Enhance each team with additional metadata
    const enhancedTeams = await Promise.all(
      (teams || []).map(async (teamMembership) =>
      {
        const teamId = teamMembership.teams.id;

        // Get player count
        const { count: playerCount, error: playerCountError } = await supabase
          .from('team_players')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);

        // Get game count
        const { count: gameCount, error: gameCountError } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);

        // Get reviewed games count (games with coaching points)
        const { data: gameIds, error: gameIdsError } = await supabase
          .from('games')
          .select('id')
          .eq('team_id', teamId);

        const { data: reviewedGames, error: reviewedGamesError } = await supabase
          .from('coaching_points')
          .select('game_id')
          .in('game_id', gameIds?.map(g => g.id) || []);

        // Get coaches for this team
        const { data: coaches, error: coachesError } = await supabase
          .from('team_memberships')
          .select(`
            user_profiles (
              name
            )
          `)
          .eq('team_id', teamId)
          .eq('role', 'coach');

        // Count unique reviewed games
        const uniqueReviewedGames = reviewedGames ?
          [...new Set(reviewedGames.map(rg => rg.game_id))].length :
          0;

        return {
          ...teamMembership,
          teams: {
            ...teamMembership.teams,
            player_count: playerCount || 0,
            game_count: gameCount || 0,
            reviewed_games_count: uniqueReviewedGames,
            coaches: coaches?.map(c => ({ name: c.user_profiles?.name || 'Unknown' })) || [],
          },
        };
      }),
    );

    res.json(enhancedTeams);
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
    const { joinCode, selectedRole, playerData } = req.body;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!joinCode)
    {
      res.status(400).json({ error: 'Join code is required' });
      return;
    }

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
      res.status(404).json({ error: 'Invalid or inactive join code' });
      return;
    }

    // Check if code is expired
    if (joinCodeData.expires_at && new Date(joinCodeData.expires_at) < new Date())
    {
      res.status(400).json({ error: 'Join code has expired' });
      return;
    }

    // Determine the role
    let roleToAssign: TeamRole;

    if (joinCodeData.team_role)
    {
      // Role is fixed by the join code
      roleToAssign = joinCodeData.team_role as TeamRole;
    }
    else if (selectedRole)
    {
      // User can select role
      if (!Object.values(TeamRole).includes(selectedRole as TeamRole))
      {
        res.status(400).json({ error: 'Invalid role selected' });
        return;
      }
      roleToAssign = selectedRole as TeamRole;
    }
    else
    {
      res.status(400).json({ error: 'Role selection is required for this join code' });
      return;
    }

    /**
     * Guardian role validation
     *
     * Validates the request payload when a user joins a team as a Guardian using a join code.
     *
     * Expected input (req.body.playerData):
     * - isNewPlayer: boolean (required)
     *   - true  => creating a new player profile:
     *       - name: string (required, trimmed, non-empty)
     *       - jerseyNumber?: string|number (optional; if provided must be 1–2 digits)
     *   - false => linking to an existing player profile:
     *       - id: string UUID (required)
     *       - user_id?: string UUID (optional; if provided must be a valid UUID)
     *
     * Additional checks when linking to existing player (isNewPlayer === false):
     * - Ensure the player profile exists (404 if not found)
     * - Permission constraint: if player_profiles.user_id is set to another user,
     *   this guardian must already have a guardian_player_relationships link to that player
     *   (403 if not permitted)
     *
     * Error responses:
     * - 400: missing/invalid fields or formats (e.g., name empty, bad UUID, jersey format)
     * - 404: player profile not found
     * - 403: guardian does not have permission to link to the player profile
     */
    // Validate Guardian role requirements
    if (roleToAssign === TeamRole.Guardian)
    {
      // Player data is now optional for guardians - they can join without player associations
      if (playerData)
      {
        if (playerData.isNewPlayer === undefined || playerData.isNewPlayer === null)
        {
          res.status(400).json({
            error: 'playerData.isNewPlayer must be specified (true for new player, false for existing)',
          });
          return;
        }

        if (playerData.isNewPlayer)
        {
          if (typeof playerData.name !== 'string' || playerData.name.trim() === '')
          {
            res.status(400).json({ error: 'Player name is required for new player' });
            return;
          }
          playerData.name = playerData.name.trim();

          // Validate jersey number if provided
          if (
            playerData.jerseyNumber !== undefined && playerData.jerseyNumber !== null && playerData.jerseyNumber !== ''
          )
          {
            const jerseyNumber = String(playerData.jerseyNumber).trim();
            if (!/^\d{1,2}$/.test(jerseyNumber))
            {
              res.status(400).json({ error: 'Jersey number must be 1-2 digits only' });
              return;
            }
          }
        }
        else
        {
          if (!playerData.id || typeof playerData.id !== 'string')
          {
            res.status(400).json({
              error: 'Player ID is required and must be a string when linking to existing player',
            });
            return;
          }
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(playerData.id))
          {
            res.status(400).json({ error: 'Player ID must be a valid UUID format' });
            return;
          }

          // Verify user has permission to link to this player
          const { data: existingPlayer, error: playerCheckError } = await supabase
            .from('player_profiles')
            .select('id, user_id')
            .eq('id', playerData.id)
            .single();

          if (playerCheckError || !existingPlayer)
          {
            res.status(404).json({ error: 'Player profile not found' });
            return;
          }

          if (playerData.user_id !== null && playerData.user_id !== undefined)
          {
            if (typeof playerData.user_id !== 'string' || playerData.user_id.trim() === '')
            {
              res.status(400).json({ error: 'User ID must be a non-empty string if provided' });
              return;
            }
            if (!uuidRegex.test(playerData.user_id))
            {
              res.status(400).json({ error: 'User ID must be a valid UUID format' });
              return;
            }
          }
        }
      }
    }
    // Validate Player role requirements
    else if (roleToAssign === TeamRole.Player)
    {
      if (!playerData)
      {
        res.status(400).json({ error: 'Player data is required for player role' });
        return;
      }

      if (playerData.isNewPlayer === undefined || playerData.isNewPlayer === null)
      {
        res.status(400).json({
          error: 'playerData.isNewPlayer must be specified (true for new player, false for existing)',
        });
        return;
      }

      if (playerData.isNewPlayer)
      {
        // For new players, ensure the name matches the user's profile name
        if (!playerData.name || typeof playerData.name !== 'string' || playerData.name.trim() === '')
        {
          res.status(400).json({ error: 'Player name is required for new player' });
          return;
        }

        // We'll validate the name against user profile later after we fetch it
      }
      else
      {
        if (!playerData.id || typeof playerData.id !== 'string')
        {
          res.status(400).json({ error: 'Player ID is required and must be a string when linking to existing player' });
          return;
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(playerData.id))
        {
          res.status(400).json({ error: 'Player ID must be a valid UUID format' });
          return;
        }

        // Verify the player profile exists and user has permission
        const { data: existingPlayer, error: playerCheckError } = await supabase
          .from('player_profiles')
          .select('id, user_id')
          .eq('id', playerData.id)
          .single();

        if (playerCheckError || !existingPlayer)
        {
          res.status(404).json({ error: 'Player profile not found' });
          return;
        }

        // Only allow linking if it's unlinked or belongs to current user
        if (existingPlayer.user_id && existingPlayer.user_id !== userId)
        {
          res.status(403).json({ error: 'This player profile is already linked to another user' });
          return;
        }
      }

      // Validate jersey number if provided
      if (playerData.jerseyNumber !== undefined && playerData.jerseyNumber !== null && playerData.jerseyNumber !== '')
      {
        const jerseyNumber = String(playerData.jerseyNumber).trim();
        if (!/^\d{1,2}$/.test(jerseyNumber))
        {
          res.status(400).json({ error: 'Jersey number must be 1-2 digits only' });
          return;
        }
      }
    }

    // Get user's profile for fallback player name
    let userProfile = null;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', userId)
      .single();

    if (profile)
    {
      userProfile = profile;
    }

    // Execute all operations in a transaction using Supabase RPC
    const { data: result, error: transactionError } = await supabase.rpc('join_team_transaction', {
      p_user_id: userId,
      p_team_id: joinCodeData.team_id,
      p_role: roleToAssign,
      p_player_data: playerData ?
        {
          isNewPlayer: playerData.isNewPlayer,
          id: playerData.id || null,
          name: playerData.name || null,
          user_id: playerData.user_id || null,
          jerseyNumber: playerData.jerseyNumber || null,
        } :
        null,
      p_user_name: userProfile?.name || 'Player',
    });

    if (transactionError)
    {
      console.error('Transaction error:', transactionError);

      // Parse specific error messages
      if (transactionError.message.includes('already taken'))
      {
        res.status(409).json({ error: transactionError.message });
        return;
      }
      else if (transactionError.message.includes('does not exist'))
      {
        res.status(404).json({ error: transactionError.message });
        return;
      }
      else if (transactionError.message.includes('permission'))
      {
        res.status(403).json({ error: transactionError.message });
        return;
      }
      else if (transactionError.message.includes('already linked'))
      {
        res.status(409).json({ error: transactionError.message });
        return;
      }

      res.status(400).json({ error: transactionError.message || 'Failed to join team' });
      return;
    }

    const teamInfo = Array.isArray(joinCodeData.teams) ? joinCodeData.teams[0] : joinCodeData.teams;

    res.status(200).json({
      message: `Successfully joined team "${teamInfo.name}" as ${roleToAssign}`,
      team: {
        id: joinCodeData.team_id,
        name: teamInfo.name,
        role: roleToAssign,
      },
    });
  }
  catch (error)
  {
    console.error('Join team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get join codes for a team
router.get(
  '/:teamId/join-codes',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Player, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;

      const { data: joinCodes, error } = await supabase
        .from('team_join_codes')
        .select(`
          id,
          code,
          team_role,
          created_at,
          expires_at,
          is_active,
          created_by,
          user_profiles!team_join_codes_created_by_fkey(name)
        `)
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error)
      {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(joinCodes || []);
    }
    catch (error)
    {
      console.error('Get team join codes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Create additional join code for a team
router.post(
  '/:teamId/join-codes',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const { team_role, expires_at, guardian } = req.body;
      const userId = req.user?.id;

      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get the current user's role on this team
      const { data: userMembership, error: membershipError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (membershipError || !userMembership)
      {
        res.status(403).json({ error: 'User is not a member of this team' });
        return;
      }

      const userRole = userMembership.role as TeamRole;

      // If the user creating the join code is a guardian, apply strict restrictions
      if (userRole === TeamRole.Guardian)
      {
        // guardians must specify a team_role
        if (!team_role)
        {
          res.status(400).json({
            error: 'guardians must specify a team_role when creating join codes',
          });
          return;
        }

        // guardians can only create join codes for player or guardian roles
        if (![TeamRole.Player, TeamRole.Guardian].includes(team_role as TeamRole))
        {
          res.status(400).json({
            error: 'guardians can only create join codes for "player" or "guardian" roles',
          });
          return;
        }
      }
      else
      {
        // Validate team_role if provided (normal validation for non-guardian codes)
        if (team_role && !Object.values(TeamRole).includes(team_role as TeamRole))
        {
          res.status(400).json({ error: 'Invalid team role' });
          return;
        }
      }

      // Generate unique join code
      const code = await generateUniqueJoinCode();

      // Create join code
      const { data: joinCodeData, error: createError } = await supabase
        .from('team_join_codes')
        .insert({
          team_id: teamId,
          code,
          created_by: userId!,
          team_role: team_role || null,
          expires_at: expires_at || null,
          is_active: true,
        })
        .select()
        .single();

      if (createError)
      {
        res.status(400).json({ error: createError.message });
        return;
      }

      res.status(201).json({
        message: 'Join code created successfully',
        join_code: joinCodeData,
      });
    }
    catch (error)
    {
      console.error('Create join code error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get labels for a team
router.get(
  '/:teamId/labels',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Player, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;

      const { data: labels, error } = await supabase
        .from('labels')
        .select('*')
        .eq('team_id', teamId)
        .order('name');

      if (error)
      {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json(labels || []);
    }
    catch (error)
    {
      console.error('Get team labels error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Create a label for a team
router.post(
  '/:teamId/labels',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const { name } = req.body;

      if (!name || !name.trim())
      {
        res.status(400).json({ error: 'Label name is required' });
        return;
      }

      const { data: label, error } = await supabase
        .from('labels')
        .insert({
          team_id: teamId,
          name: name.trim(),
        })
        .select()
        .single();

      if (error)
      {
        if (error.code === '23505')
        { // Unique constraint violation
          res.status(409).json({ error: 'Label with this name already exists for this team' });
          return;
        }
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(201).json(label);
    }
    catch (error)
    {
      console.error('Create team label error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get team details
router.get(
  '/:teamId',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Player, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const userId = req.user?.id;

      // Get team basic info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError)
      {
        res.status(400).json({ error: teamError.message });
        return;
      }

      // Get user's role on this team
      const { data: userMembership, error: membershipError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId!)
        .single();

      if (membershipError)
      {
        res.status(403).json({ error: 'User is not a member of this team' });
        return;
      }

      const userRole = userMembership.role as TeamRole;

      // Get member counts by role
      const { data: memberCounts, error: countError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId);

      if (countError)
      {
        res.status(400).json({ error: countError.message });
        return;
      }

      // Get player count using Supabase count functionality
      const { count: playerCount, error: playerCountError } = await supabase
        .from('team_players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if (playerCountError)
      {
        res.status(400).json({ error: playerCountError.message });
        return;
      }

      // Get game count using Supabase count functionality
      const { count: gameCount, error: gameCountError } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if (gameCountError)
      {
        res.status(400).json({ error: gameCountError.message });
        return;
      }

      // Get join codes with role-based filtering
      const { data: joinCodes, error: joinCodesError } = await supabase
        .from('team_join_codes')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (joinCodesError)
      {
        res.status(400).json({ error: joinCodesError.message });
        return;
      }

      // Filter join codes based on user's role
      // Everyone sees player & guardian codes, only coaches/admins see coach & admin codes
      const filteredJoinCodes = joinCodes?.filter(code =>
      {
        if (!code.team_role) return true; // Show codes without specific roles

        const codeRole = code.team_role as TeamRole;

        // Everyone can see player and guardian codes
        if (codeRole === TeamRole.Player || codeRole === TeamRole.Guardian)
        {
          return true;
        }

        // Only coaches and admins can see coach and admin codes
        if (userRole === TeamRole.Coach || userRole === TeamRole.Admin)
        {
          return true;
        }

        return false;
      }) || [];

      // Count members by role
      const roleCounts = memberCounts?.reduce((acc: Record<string, number>, member) =>
      {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
      }, {}) || {};

      res.json({
        ...teamData,
        user_role: userRole,
        member_counts: {
          ...roleCounts,
          players: playerCount || 0,
        },
        total_games: gameCount || 0,
        join_codes: filteredJoinCodes.map(code => ({
          id: code.id,
          code: code.code,
          team_role: code.team_role,
          created_at: code.created_at,
          expires_at: code.expires_at,
          is_active: code.is_active,
        })),
      });
    }
    catch (error)
    {
      console.error('Get team details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get team members grouped by role
router.get(
  '/:teamId/members',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Player, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const userId = req.user?.id;

      // Get all team memberships (coaches, admins, guardians, players)
      const { data: memberships, error: membershipsError } = await supabase
        .from('team_memberships')
        .select(`
          id,
          role,
          created_at,
          user_profiles (
            id,
            name,
            email,
            created_at
          )
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (membershipsError)
      {
        res.status(400).json({ error: membershipsError.message });
        return;
      }

      // Get players with their profiles and jersey numbers
      const { data: players, error: playersError } = await supabase
        .from('team_players')
        .select(`
          created_at,
          jersey_number,
          player_profiles (
            id,
            name,
            user_id,
            created_at,
            user_profiles!player_profiles_user_id_fkey (
              id,
              name,
              email,
              created_at
            )
          )
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (playersError)
      {
        res.status(400).json({ error: playersError.message });
        return;
      }

      // Get guardian relationships for current user if they're a guardian
      let userGuardianRelationships: string[] = [];
      const currentUserMembership = memberships?.find(m => m.user_profiles?.id === userId);

      if (currentUserMembership?.role === TeamRole.Guardian && userId)
      {
        const { data: guardianRels, error: guardianRelError } = await supabase
          .from('guardian_player_relationships')
          .select('player_profile_id')
          .eq('guardian_id', userId);

        if (!guardianRelError && guardianRels)
        {
          userGuardianRelationships = guardianRels.map(rel => rel.player_profile_id);
        }
      }

      // Build guardian relationship map for all guardians on this team (only players on this team)
      const guardianIds = (memberships || [])
        .filter(m => m.role === TeamRole.Guardian)
        .map(m => m.user_profiles?.id)
        .filter((id): id is string => Boolean(id));

      const teamPlayerProfileIds = (players || [])
        .map(tp => tp.player_profiles?.id)
        .filter((id): id is string => Boolean(id));

      let guardianRelationshipMap: Record<string, { id: string; name: string; jersey_number: string | null; }[]> = {};

      if (guardianIds.length > 0 && teamPlayerProfileIds.length > 0)
      {
        const { data: guardianRelsAll, error: guardianRelsAllError } = await supabase
          .from('guardian_player_relationships')
          .select(`
            guardian_id,
            player_profile_id,
            player_profiles (
              id,
              name
            )
          `)
          .in('guardian_id', guardianIds)
          .in('player_profile_id', teamPlayerProfileIds);

        if (!guardianRelsAllError && guardianRelsAll)
        {
          // Map player profile id -> jersey number for quick lookup
          const jerseyMap: Record<string, string | null> = {};
          (players || []).forEach(tp =>
          {
            const pid = tp.player_profiles?.id;
            if (pid)
            {
              jerseyMap[pid] = tp.jersey_number || null;
            }
          });

          guardianRelationshipMap = guardianRelsAll.reduce((acc, rel) =>
          {
            const guardianId = rel.guardian_id;
            const profile = Array.isArray(rel.player_profiles) ? rel.player_profiles[0] : rel.player_profiles;
            if (profile?.id && profile?.name)
            {
              if (!acc[guardianId])
              {
                acc[guardianId] = [];
              }
              acc[guardianId].push({
                id: profile.id,
                name: profile.name,
                jersey_number: jerseyMap[profile.id] || null,
              });
            }
            return acc;
          }, {} as Record<string, { id: string; name: string; jersey_number: string | null; }[]>);
        }
      }

      // Group members by role
      const membersByRole: Record<string, any[]> = {
        players: [],
        coaches: [],
        admins: [],
        guardians: [],
      };

      // Process regular memberships (coaches, admins, guardians, players with user accounts)
      memberships?.forEach(membership =>
      {
        const memberRole = membership.role as TeamRole;
        const memberUserId = membership.user_profiles?.id;
        const isSelf = memberUserId === userId;

        // Determine if current user can remove this member
        let canRemove = false;
        if (isSelf)
        {
          // Anyone can remove themselves
          canRemove = true;
        }
        else if (currentUserMembership?.role === TeamRole.Coach || currentUserMembership?.role === TeamRole.Admin)
        {
          // Coaches and admins can remove guardians
          if (memberRole === TeamRole.Guardian)
          {
            canRemove = true;
          }
          // Coaches can remove admins
          if (currentUserMembership.role === TeamRole.Coach && memberRole === TeamRole.Admin)
          {
            canRemove = true;
          }
        }

        const member = {
          id: membership.id,
          user_id: membership.user_profiles?.id,
          name: membership.user_profiles?.name,
          email: membership.user_profiles?.email,
          role: membership.role,
          joined_at: membership.created_at,
          user_created_at: membership.user_profiles?.created_at,
          can_remove: canRemove,
          // Include related players (names only) for guardians (frontend will decide what to display)
          related_players: membership.role === TeamRole.Guardian ?
            (guardianRelationshipMap[membership.user_profiles?.id || ''] || []) :
            undefined,
        };

        switch (membership.role)
        {
          case TeamRole.Coach:
            membersByRole.coaches.push(member);
            break;
          case TeamRole.Admin:
            membersByRole.admins.push(member);
            break;
          case TeamRole.Guardian:
            membersByRole.guardians.push(member);
            break;
          case TeamRole.Player:
            // Players with user accounts will be handled separately below
            break;
        }
      });

      // Process players (including those without user accounts)
      players?.forEach(teamPlayer =>
      {
        const playerProfile = teamPlayer.player_profiles;
        if (playerProfile)
        {
          const player = {
            id: playerProfile.id,
            user_id: playerProfile.user_id,
            name: playerProfile.name,
            email: playerProfile.user_profiles?.email || null,
            jersey_number: teamPlayer.jersey_number,
            joined_at: teamPlayer.created_at,
            profile_created_at: playerProfile.created_at,
            user_created_at: playerProfile.user_profiles?.created_at || null,
            can_remove: currentUserMembership?.role === TeamRole.Coach ||
              currentUserMembership?.role === TeamRole.Admin ||
              (currentUserMembership?.role === TeamRole.Guardian &&
                userGuardianRelationships.includes(playerProfile.id)) ||
              (currentUserMembership?.role === TeamRole.Player &&
                playerProfile.user_id === userId),
          };
          membersByRole.players.push(player);
        }
      });

      res.json(membersByRole);
    }
    catch (error)
    {
      console.error('Get team members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get players for a team
router.get(
  '/:teamId/players',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Player, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;

      const { data: players, error } = await supabase
        .from('team_players')
        .select(`
          created_at,
          jersey_number,
          player_profiles (
            id,
            name,
            user_id,
            created_at
          )
        `)
        .eq('team_id', teamId);

      if (error)
      {
        res.status(400).json({ error: error.message });
        return;
      }

      // Flatten the structure and include join date
      const flattenedPlayers = players?.map(tp => ({
        ...tp.player_profiles,
        jersey_number: tp.jersey_number,
        team_joined_at: tp.created_at,
      })).filter(Boolean) || [];

      res.json(flattenedPlayers);
    }
    catch (error)
    {
      console.error('Get team players error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Create player profile - require coach, admin, or guardian role
router.post(
  '/:teamId/player-profiles',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin, TeamRole.Guardian]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;
      const { name, jerseyNumber, userRole } = req.body;
      const userId = req.user?.id;

      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!name || !name.trim())
      {
        res.status(400).json({ error: 'Player name is required' });
        return;
      }

      if (!userRole || !['guardian', 'coach', 'admin', 'staff'].includes(userRole))
      {
        res.status(400).json({ error: 'Valid user role is required' });
        return;
      }

      // Get user's role on this team to verify permissions
      const { data: userMembership, error: membershipError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (membershipError || !userMembership)
      {
        res.status(403).json({ error: 'User is not a member of this team' });
        return;
      }

      // Check if jersey number is already taken (if provided)
      if (jerseyNumber && jerseyNumber.trim())
      {
        const { data: existingPlayer, error: jerseyCheckError } = await supabase
          .from('team_players')
          .select('jersey_number')
          .eq('team_id', teamId)
          .eq('jersey_number', jerseyNumber.trim());

        if (jerseyCheckError)
        {
          res.status(400).json({ error: 'Failed to check jersey number availability' });
          return;
        }

        if (existingPlayer && existingPlayer.length > 0)
        {
          res.status(409).json({ error: 'Jersey number is already taken' });
          return;
        }
      }

      // Perform database operations with error handling for rollback
      let playerProfileId: string | null = null;
      let teamPlayerCreated = false;

      try
      {
        // Create player profile
        const { data: playerProfile, error: playerError } = await supabase
          .from('player_profiles')
          .insert({
            name: name.trim(),
            user_id: null, // Player profiles created this way don't have associated users initially
            created_by: userId,
          })
          .select()
          .single();

        if (playerError)
        {
          res.status(400).json({ error: 'Failed to create player profile' });
          return;
        }

        playerProfileId = playerProfile.id;

        // Link player to team
        const { error: linkError } = await supabase
          .from('team_players')
          .insert({
            team_id: teamId,
            player_id: playerProfile.id,
            jersey_number: jerseyNumber?.trim() || null,
          });

        if (linkError)
        {
          // Rollback player profile creation
          await supabase
            .from('player_profiles')
            .delete()
            .eq('id', playerProfile.id);

          res.status(400).json({ error: 'Failed to link player to team' });
          return;
        }

        teamPlayerCreated = true;

        // If user role is guardian, create guardian relationship
        if (userRole === 'guardian')
        {
          const { error: guardianError } = await supabase
            .from('guardian_player_relationships')
            .insert({
              guardian_id: userId,
              player_user_id: null, // No user account associated yet
              player_profile_id: playerProfile.id,
            });

          if (guardianError)
          {
            // Rollback team player and player profile creation
            await supabase
              .from('team_players')
              .delete()
              .eq('team_id', teamId)
              .eq('player_id', playerProfile.id);

            await supabase
              .from('player_profiles')
              .delete()
              .eq('id', playerProfile.id);

            res.status(400).json({ error: 'Failed to create guardian relationship' });
            return;
          }
        }

        const roleDescription = userRole === 'guardian' ?
          'Player profile created with guardian relationship' :
          'Player profile created';

        res.status(201).json({
          message: roleDescription,
          player: {
            id: playerProfile.id,
            name: playerProfile.name,
            jersey_number: jerseyNumber?.trim() || null,
            team_id: teamId,
            has_guardian_relationship: userRole === 'guardian',
          },
        });
      }
      catch (error)
      {
        // Cleanup on unexpected error
        if (teamPlayerCreated && playerProfileId)
        {
          await supabase
            .from('team_players')
            .delete()
            .eq('team_id', teamId)
            .eq('player_id', playerProfileId);
        }

        if (playerProfileId)
        {
          await supabase
            .from('player_profiles')
            .delete()
            .eq('id', playerProfileId);
        }

        throw error;
      }
    }
    catch (error)
    {
      console.error('Create player profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Remove member from team - require appropriate permissions
router.put(
  '/:teamId/members/:membershipId/remove',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId, membershipId } = req.params;
      const userId = req.user?.id;

      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get the current user's role on this team
      const { data: userMembership, error: userMembershipError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (userMembershipError || !userMembership)
      {
        res.status(403).json({ error: 'User is not a member of this team' });
        return;
      }

      const userRole = userMembership.role as TeamRole;

      // Get the member to be removed
      const { data: targetMembership, error: targetMembershipError } = await supabase
        .from('team_memberships')
        .select(`
          id,
          role,
          user_id,
          user_profiles (
            name,
            email
          )
        `)
        .eq('id', membershipId)
        .eq('team_id', teamId)
        .single();

      if (targetMembershipError || !targetMembership)
      {
        res.status(404).json({ error: 'Member not found in this team' });
        return;
      }

      const targetRole = targetMembership.role as TeamRole;
      const targetUserId = targetMembership.user_id;
      const isSelfRemoval = targetUserId === userId;

      // Check permissions
      let hasPermission = false;

      if (isSelfRemoval)
      {
        // Anyone can remove themselves
        hasPermission = true;
      }
      else if (userRole === TeamRole.Coach || userRole === TeamRole.Admin)
      {
        // Coaches and admins can remove guardians
        if (targetRole === TeamRole.Guardian)
        {
          hasPermission = true;
        }
        // Coaches can remove admins
        if (userRole === TeamRole.Coach && targetRole === TeamRole.Admin)
        {
          hasPermission = true;
        }
      }

      if (!hasPermission)
      {
        res.status(403).json({ error: 'Insufficient permissions to remove this member from team' });
        return;
      }

      // Perform removal
      try
      {
        // Remove team membership
        const { error: removeMemberError } = await supabase
          .from('team_memberships')
          .delete()
          .eq('id', membershipId)
          .eq('team_id', teamId);

        if (removeMemberError)
        {
          res.status(400).json({ error: 'Failed to remove member from team' });
          return;
        }

        const memberName = targetMembership.user_profiles?.name || 'Unknown';

        res.json({
          message: isSelfRemoval ?
            'You have left the team successfully' :
            `${memberName} has been removed from the team`,
        });
      }
      catch (removeError)
      {
        console.error('Remove member error:', removeError);
        res.status(500).json({ error: 'Failed to remove member from team' });
      }
    }
    catch (error)
    {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Update player jersey number - require coach, admin, guardian with relationship, or player themselves
router.put(
  '/:teamId/players/:playerId/jersey-number',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId, playerId } = req.params;
      const { jerseyNumber } = req.body;
      const userId = req.user?.id;

      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Check if user is a member of this team
      const { data: userMembership, error: membershipError } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .single();

      if (membershipError || !userMembership)
      {
        res.status(403).json({ error: 'User is not a member of this team' });
        return;
      }

      const userRole = userMembership.role as TeamRole;

      // Check if player exists and belongs to this team
      const { data: teamPlayer, error: teamPlayerError } = await supabase
        .from('team_players')
        .select(`
          id,
          jersey_number,
          player_profiles (
            id,
            name,
            user_id
          )
        `)
        .eq('team_id', teamId)
        .eq('player_id', playerId)
        .single();

      if (teamPlayerError || !teamPlayer)
      {
        res.status(404).json({ error: 'Player not found in this team' });
        return;
      }

      // Check permissions
      let hasPermission = false;

      if (userRole === TeamRole.Coach || userRole === TeamRole.Admin)
      {
        // Coaches and admins can edit any player's jersey number
        hasPermission = true;
      }
      else if (userRole === TeamRole.Guardian)
      {
        // Guardians can only edit jersey numbers for players they have a relationship with
        const { data: guardianRelationship, error: relationshipError } = await supabase
          .from('guardian_player_relationships')
          .select('id')
          .eq('guardian_id', userId)
          .eq('player_profile_id', playerId)
          .single();

        if (!relationshipError && guardianRelationship)
        {
          hasPermission = true;
        }
      }
      else if (userRole === TeamRole.Player)
      {
        // Players can edit their own jersey number
        const playerProfile = teamPlayer.player_profiles;
        if (playerProfile?.user_id === userId)
        {
          hasPermission = true;
        }
      }

      if (!hasPermission)
      {
        res.status(403).json({ error: "Insufficient permissions to edit this player's jersey number" });
        return;
      }

      // Validate jersey number
      let validatedJerseyNumber: string | null = null;
      if (jerseyNumber !== null && jerseyNumber !== undefined && jerseyNumber !== '')
      {
        const trimmedNumber = String(jerseyNumber).trim();

        // Validate format: only numbers, max 2 characters
        if (!/^\d{1,2}$/.test(trimmedNumber))
        {
          res.status(400).json({ error: 'Jersey number must be 1-2 digits only' });
          return;
        }

        validatedJerseyNumber = trimmedNumber;
      }

      // Update jersey number
      const { error: updateError } = await supabase
        .from('team_players')
        .update({ jersey_number: validatedJerseyNumber })
        .eq('team_id', teamId)
        .eq('player_id', playerId);

      if (updateError)
      {
        res.status(400).json({ error: 'Failed to update jersey number' });
        return;
      }

      const playerProfile = teamPlayer.player_profiles;
      const playerName = playerProfile?.name || 'Unknown';

      res.json({
        message: 'Jersey number updated successfully',
        player: {
          id: playerId,
          name: playerName,
          jersey_number: validatedJerseyNumber,
        },
      });
    }
    catch (error)
    {
      console.error('Update jersey number error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Remove player from team - require coach, admin, guardian with relationship, or player themselves
router.put(
  '/:teamId/players/:playerId/remove',
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    // Local type for RPC result (until generated types include the function)
    interface RemovePlayerFromTeamTxnResult
    {
      success: boolean;
      is_self_removal: boolean;
      player: {
        player_profile_id: string;
        name: string;
        jersey_number: string | null;
      };
      message: string;
    }
    try
    {
      const { teamId, playerId } = req.params;
      const userId = req.user?.id;

      if (!userId)
      {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Execute transactional removal via RPC (all-or-nothing)
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'remove_player_from_team_transaction',
        {
          p_user_id: userId,
          p_team_id: teamId,
          p_player_id: playerId,
        },
      );

      if (rpcError)
      {
        const msg = rpcError.message || '';
        let status = 400;
        if (/not a member/i.test(msg) || /Insufficient permissions/i.test(msg)) status = 403;
        else if (/not found on team/i.test(msg)) status = 404;
        else if (/Invariant violation/i.test(msg)) status = 409;
        console.error('remove_player_from_team_transaction RPC error:', rpcError);
        res.status(status).json({ error: msg || 'Failed to remove player from team' });
        return;
      }

      const result = rpcData as RemovePlayerFromTeamTxnResult | null;
      const message = result?.message || 'Player removed from team';
      res.json({ message, result });
    }
    catch (error)
    {
      console.error('Remove player error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Delete team - require coach or admin role
router.delete(
  '/:teamId',
  requireTeamRole([TeamRole.Coach, TeamRole.Admin]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> =>
  {
    try
    {
      const { teamId } = req.params;

      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError)
      {
        res.status(400).json({ error: deleteError.message });
        return;
      }

      res.json({
        message: 'Team deleted successfully',
      });
    }
    catch (error)
    {
      console.error('Delete team error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
