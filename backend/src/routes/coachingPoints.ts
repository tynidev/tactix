import express, { Response } from 'express';
import { type AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

// Helper function to validate coaching point access and get target player ID
interface CoachingPointValidationResult {
  targetPlayerId: string;
  coachingPoint: any;
}

async function validateCoachingPointAccess(
  coachingPointId: string,
  userId: string,
  playerIdOverride?: string
): Promise<CoachingPointValidationResult> {
  // First verify the coaching point exists and user has access to it
  const { data: coachingPoint, error: coachingPointError } = await supabase
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
    .eq('id', coachingPointId)
    .eq('games.teams.team_memberships.user_id', userId)
    .single();

  if (coachingPointError || !coachingPoint) {
    throw new Error('COACHING_POINT_NOT_FOUND');
  }

  let targetPlayerId: string;

  if (playerIdOverride) {
    // Guardian proxy acknowledgment - verify the user is a guardian of the specified player
    const { data: guardianRelationship, error: guardianError } = await supabase
      .from('guardian_player_relationships')
      .select('player_profile_id')
      .eq('guardian_id', userId)
      .eq('player_profile_id', playerIdOverride)
      .single();

    if (guardianError || !guardianRelationship) {
      throw new Error('GUARDIAN_ACCESS_DENIED');
    }

    targetPlayerId = playerIdOverride;
  } else {
    // Get user's own player profile
    const { data: playerProfile, error: playerError } = await supabase
      .from('player_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (playerError || !playerProfile) {
      throw new Error('PLAYER_PROFILE_NOT_FOUND');
    }

    targetPlayerId = playerProfile.id;
  }

  return { targetPlayerId, coachingPoint };
}

// POST /api/coaching-points - Create a new coaching point
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

    const {
      game_id,
      title,
      feedback,
      timestamp,
      audio_url = '',
      duration = 0,
    } = req.body;

    // Validate required fields
    if (!game_id || !title || !timestamp)
    {
      res.status(400).json({
        message: 'Missing required fields: game_id, title, timestamp',
      });
      return;
    }

    // Verify the user has permission to create coaching points for this game
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        teams!inner(
          id,
          team_memberships!inner(
            user_id,
            role
          )
        )
      `)
      .eq('id', game_id)
      .eq('teams.team_memberships.user_id', userId)
      .single();

    if (gameError || !gameData)
    {
      res.status(404).json({ message: 'Game not found or access denied' });
      return;
    }

    // Check if user is a coach
    const userRole = gameData.teams.team_memberships[0]?.role;
    if (!userRole || !['coach'].includes(userRole))
    {
      res.status(403).json({
        message: 'Only coaches can create coaching points',
      });
      return;
    }

    // Create the coaching point
    const { data: coachingPoint, error } = await supabase
      .from('coaching_points')
      .insert({
        game_id,
        author_id: userId, // Use the authenticated user's ID
        title,
        feedback,
        timestamp,
        audio_url,
        duration,
      })
      .select('*')
      .single();

    if (error)
    {
      console.error('Error creating coaching point:', error);
      res.status(500).json({ message: 'Failed to create coaching point' });
      return;
    }

    res.status(201).json(coachingPoint);
  }
  catch (error)
  {
    console.error('Error in POST /coaching-points:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/coaching-points/game/:gameId - Get coaching points for a game
router.get('/game/:gameId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const userId = req.user?.id;
    if (!userId)
    {
      res.status(401).json({ message: 'User ID not found' });
      return;
    }

    const { gameId } = req.params;

    // Verify the user has access to this game
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        teams!inner(
          id,
          team_memberships!inner(
            user_id,
            role
          )
        )
      `)
      .eq('id', gameId)
      .eq('teams.team_memberships.user_id', userId)
      .single();

    if (gameError || !gameData)
    {
      res.status(404).json({ message: 'Game not found or access denied' });
      return;
    }

    // Get coaching points for this game
    const { data: coachingPoints, error } = await supabase
      .from('coaching_points')
      .select(`
        *,
        author:user_profiles!author_id(
          id,
          name,
          email
        ),
        coaching_point_tagged_players(
          id,
          player_profiles(
            id,
            name
          )
        ),
        coaching_point_labels(
          id,
          labels(
            id,
            name
          )
        ),
        coaching_point_events(
          id,
          event_type,
          timestamp,
          event_data,
          created_at
        )
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });

    if (error)
    {
      console.error('Error fetching coaching points:', error);
      res.status(500).json({ message: 'Failed to fetch coaching points' });
      return;
    }

    res.json(coachingPoints || []);
  }
  catch (error)
  {
    console.error('Error in GET /coaching-points/game/:gameId:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/coaching-points/:id - Delete a coaching point
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

    // Get the coaching point and verify permissions
    const { data: coachingPoint, error: fetchError } = await supabase
      .from('coaching_points')
      .select(`
        *,
        games!inner(
          teams!inner(
            team_memberships!inner(
              user_id,
              role
            )
          )
        )
      `)
      .eq('id', id)
      .eq('games.teams.team_memberships.user_id', userId)
      .single();

    if (fetchError || !coachingPoint)
    {
      res.status(404).json({ message: 'Coaching point not found or access denied' });
      return;
    }

    // Check if user is the author or has admin/coach privileges
    const userRole = coachingPoint.games.teams.team_memberships[0]?.role;
    const isAuthor = coachingPoint.author_id === userId;
    const hasPermission = isAuthor || ['coach'].includes(userRole);

    if (!hasPermission)
    {
      res.status(403).json({
        message: 'Only the author or coaches can delete coaching points',
      });
      return;
    }

    // Delete the coaching point (events and other related data will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('coaching_points')
      .delete()
      .eq('id', id);

    if (deleteError)
    {
      console.error('Error deleting coaching point:', deleteError);
      res.status(500).json({ message: 'Failed to delete coaching point' });
      return;
    }

    res.status(204).send();
  }
  catch (error)
  {
    console.error('Error in DELETE /coaching-points/:id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/coaching-points/:id/acknowledgment - Get acknowledgment for a coaching point
// Supports optional player_id query parameter for guardian proxy acknowledgments
router.get('/:id/acknowledgment', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
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
    const { player_id } = req.query;
    
    // Type guard for player_id query parameter
    const playerIdParam = typeof player_id === 'string' ? player_id : undefined;

    let targetPlayerId: string;

    try {
      // Validate that the coaching point exists, user has team access, and get target player ID
      // For guardian proxy: verifies guardian relationship; For direct access: gets user's player profile
      const result = await validateCoachingPointAccess(id, userId, playerIdParam);
      targetPlayerId = result.targetPlayerId;
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'COACHING_POINT_NOT_FOUND':
            res.status(404).json({ message: 'Coaching point not found or access denied' });
            return;
          case 'GUARDIAN_ACCESS_DENIED':
            res.status(403).json({ message: 'Access denied: not authorized to view acknowledgment for this player' });
            return;
          case 'PLAYER_PROFILE_NOT_FOUND':
            // User might not have a player profile (e.g., coach) - return empty acknowledgment
            res.json({
              acknowledged: false,
              ack_at: null,
              notes: null
            });
            return;
          default:
            throw error;
        }
      }
      throw error;
    }

    // Get the acknowledgment record
    const { data: acknowledgment, error: ackError } = await supabase
      .from('coaching_point_views')
      .select('acknowledged, ack_at, notes')
      .eq('point_id', id)
      .eq('player_id', targetPlayerId)
      .single();

    if (ackError && ackError.code !== 'PGRST116') // PGRST116 = no rows returned
    {
      console.error('Error fetching acknowledgment:', ackError);
      res.status(500).json({ message: 'Failed to fetch acknowledgment' });
      return;
    }

    // Return acknowledgment data or defaults if no record exists
    res.json({
      acknowledged: acknowledgment?.acknowledged || false,
      ack_at: acknowledgment?.ack_at || null,
      notes: acknowledgment?.notes || null
    });
  }
  catch (error)
  {
    console.error('Error in GET /coaching-points/:id/acknowledgment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/coaching-points/:id/acknowledge - Create or update acknowledgment with notes
// Supports guardian proxy acknowledgments via player_id in request body
router.post('/:id/acknowledge', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> =>
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
    const { acknowledged, notes, player_id } = req.body;

    // Validate input
    if (typeof acknowledged !== 'boolean')
    {
      res.status(400).json({ message: 'acknowledged field must be a boolean' });
      return;
    }

    if (notes && typeof notes !== 'string')
    {
      res.status(400).json({ message: 'notes field must be a string' });
      return;
    }

    // Validate notes length (1024 character limit)
    if (notes && notes.length > 1024)
    {
      res.status(400).json({ message: 'Notes cannot exceed 1024 characters' });
      return;
    }

    if (player_id && typeof player_id !== 'string')
    {
      res.status(400).json({ message: 'player_id field must be a string' });
      return;
    }

    let targetPlayerId: string;

    try {
      // Validate that the coaching point exists, user has team access, and get target player ID
      // For guardian proxy: verifies guardian relationship; For direct access: gets user's player profile
      const result = await validateCoachingPointAccess(id, userId, player_id);
      targetPlayerId = result.targetPlayerId;
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'COACHING_POINT_NOT_FOUND':
            res.status(404).json({ message: 'Coaching point not found or access denied' });
            return;
          case 'GUARDIAN_ACCESS_DENIED':
            res.status(403).json({ message: 'Access denied: not authorized to acknowledge for this player' });
            return;
          case 'PLAYER_PROFILE_NOT_FOUND':
            res.status(403).json({ message: 'Only players can acknowledge coaching points' });
            return;
          default:
            throw error;
        }
      }
      throw error;
    }

    // Prepare the data to upsert
    const upsertData = {
      point_id: id,
      player_id: targetPlayerId,
      acknowledged: acknowledged,
      ack_at: acknowledged ? new Date().toISOString() : null,
      notes: notes || null
    };

    // Upsert the acknowledgment record
    const { data: acknowledgmentRecord, error: upsertError } = await supabase
      .from('coaching_point_views')
      .upsert(upsertData, {
        onConflict: 'point_id,player_id'
      })
      .select('acknowledged, ack_at, notes')
      .single();

    if (upsertError)
    {
      console.error('Error upserting acknowledgment:', upsertError);
      res.status(500).json({ message: 'Failed to save acknowledgment' });
      return;
    }

    res.json(acknowledgmentRecord);
  }
  catch (error)
  {
    console.error('Error in POST /coaching-points/:id/acknowledge:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
