import { Request, Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Search players endpoint
router.get('/search', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { q: searchTerm, teamId, joinCode } = req.query;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    let searchTermStr = '';
    if (searchTerm && typeof searchTerm === 'string')
    {
      searchTermStr = searchTerm;
    }

    if (!teamId || typeof teamId !== 'string')
    {
      res.status(400).json({ error: 'Team ID is required' });
      return;
    }

    // Check access via either team membership OR valid join code
    let hasAccess = false;

    // First, check if user is already a member of the team
    const { data: userMembership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!membershipError && userMembership)
    {
      hasAccess = true;
    }
    // If not a member, check if they have a valid join code for this team
    else if (joinCode && typeof joinCode === 'string')
    {
      const { data: joinCodeData, error: joinCodeError } = await supabase
        .from('team_join_codes')
        .select('team_id, is_active, expires_at')
        .eq('code', joinCode)
        .eq('team_id', teamId)
        .eq('is_active', true)
        .single();

      if (!joinCodeError && joinCodeData)
      {
        // Check if code is not expired
        if (!joinCodeData.expires_at || new Date(joinCodeData.expires_at) > new Date())
        {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess)
    {
      res.status(403).json({
        error: 'Access denied. You must be a team member or provide a valid join code for this team.',
      });
      return;
    }

    // Search for players in the specified team
    const { data: teamPlayers, error: searchError } = await supabase
      .from('team_players')
      .select(`
        jersey_number,
        player_profiles (
          id,
          name,
          user_id,
          created_at
        ),
        teams (
          id,
          name
        )
      `)
      .eq('team_id', teamId)
      .ilike('player_profiles.name', `%${searchTermStr}%`)
      .order('name', { foreignTable: 'player_profiles', ascending: true });

    if (searchError)
    {
      res.status(400).json({ error: searchError.message });
      return;
    }

    // Format the results
    const players = teamPlayers?.map(tp =>
    {
      const playerProfile = tp.player_profiles;
      const team = tp.teams;

      if (!playerProfile || !team) return null;

      return {
        id: playerProfile.id,
        name: playerProfile.name,
        jersey_number: tp.jersey_number,
        team_name: team.name,
        user_id: playerProfile.user_id,
        is_claimed: !!playerProfile.user_id, // Player is claimed if they have a user_id
        created_at: playerProfile.created_at,
      };
    }).filter(Boolean) || [];

    res.json(players);
  }
  catch (error)
  {
    console.error('Search players error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link player profile to user account
router.post('/link', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { playerId, userRole } = req.body;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!playerId)
    {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    if (!userRole || !['player', 'guardian'].includes(userRole))
    {
      res.status(400).json({ error: 'Valid user role is required (player or guardian)' });
      return;
    }

    // Check if player exists and is not already claimed
    const { data: playerProfile, error: playerError } = await supabase
      .from('player_profiles')
      .select('id, name, user_id')
      .eq('id', playerId)
      .single();

    if (playerError || !playerProfile)
    {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    if (userRole === 'player')
    {
      // For player role, link user account to player profile
      if (playerProfile.user_id)
      {
        res.status(409).json({ error: 'This player profile is already claimed by another user' });
        return;
      }

      // Update player profile with user_id
      const { error: linkError } = await supabase
        .from('player_profiles')
        .update({ user_id: userId })
        .eq('id', playerId);

      if (linkError)
      {
        res.status(400).json({ error: 'Failed to link player profile' });
        return;
      }

      res.json({
        message: 'Player profile linked successfully',
        player: {
          id: playerProfile.id,
          name: playerProfile.name,
          user_id: userId,
        },
      });
    }
    else if (userRole === 'guardian')
    {
      // For guardian role, create guardian relationship

      // Check if guardian relationship already exists
      const { data: existingRelationship, error: relationshipCheckError } = await supabase
        .from('guardian_player_relationships')
        .select('id')
        .eq('guardian_id', userId)
        .eq('player_profile_id', playerId)
        .single();

      if (!relationshipCheckError && existingRelationship)
      {
        res.status(409).json({ error: 'Guardian relationship already exists' });
        return;
      }

      // Create guardian relationship
      const { error: guardianError } = await supabase
        .from('guardian_player_relationships')
        .insert({
          guardian_id: userId,
          player_user_id: playerProfile.user_id,
          player_profile_id: playerId,
        });

      if (guardianError)
      {
        res.status(400).json({ error: 'Failed to create guardian relationship' });
        return;
      }

      res.json({
        message: 'Guardian relationship created successfully',
        player: {
          id: playerProfile.id,
          name: playerProfile.name,
          guardian_id: userId,
        },
      });
    }
  }
  catch (error)
  {
    console.error('Link player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/players/guardian/team/:teamId - Get players for a guardian in a specific team
router.get('/guardian/team/:teamId', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { teamId } = req.params;

    // Verify the user is a member of the team (any role)
    const { data: teamMembership, error: teamError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (teamError || !teamMembership)
    {
      res.status(403).json({ message: 'Access denied: not a member of this team' });
      return;
    }

    // Get the guardian's players that are on this team
    const { data: guardianPlayers, error: playersError } = await supabase
      .from('guardian_player_relationships')
      .select(`
        player_profile_id,
        player_profiles!inner(
          id,
          name,
          team_players!inner(
            team_id,
            jersey_number
          )
        )
      `)
      .eq('guardian_id', userId)
      .eq('player_profiles.team_players.team_id', teamId);

    if (playersError)
    {
      console.error('Error fetching guardian players:', playersError);
      res.status(500).json({ message: 'Failed to fetch guardian players' });
      return;
    }

    // Transform the data for easier frontend consumption
    const players = guardianPlayers.map(relationship => ({
      id: relationship.player_profiles.id,
      name: relationship.player_profiles.name,
      jersey_number: relationship.player_profiles.team_players[0]?.jersey_number || null,
    }));

    res.json(players);
  }
  catch (error)
  {
    console.error('Error in GET /players/guardian/team/:teamId:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
