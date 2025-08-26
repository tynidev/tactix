import { Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { TeamRole } from '../types/database.js';
import { requireTeamRole } from '../utils/roleAuth.js';
import { supabase } from '../utils/supabase.js';
import { deleteThumbnail, extractAndStoreThumbnail } from '../utils/thumbnailUtils.js';
import { parseVeoVideo } from '../utils/veoParser.js';
import { extractYouTubeId, parseVideoInfo } from '../utils/videoUtils.js';
import { validateYouTubeVideo } from '../utils/youtubeValidator.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Get all games from teams the user has access to
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

    // Get all teams the user is a member of
    const { data: memberships, error: membershipError } = await supabase
      .from('team_memberships')
      .select('team_id, role')
      .eq('user_id', userId);

    if (membershipError)
    {
      res.status(400).json({ error: membershipError.message });
      return;
    }

    if (!memberships || memberships.length === 0)
    {
      res.json([]);
      return;
    }

    const teamIds = memberships.map(m => m.team_id);

    // Get games for all teams with team information and coaching points count
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        team_id,
        opponent,
        date,
        location,
        video_id,
        video_url,
        thumbnail_url,
        thumbnail_file_path,
        team_score,
        opp_score,
        game_type,
        home_away,
        notes,
        created_at,
        teams!inner(id, name)
      `)
      .in('team_id', teamIds)
      .order('date', { ascending: false });

    if (gamesError)
    {
      res.status(400).json({ error: gamesError.message });
      return;
    }

    // Add user role for each game and coaching points count
    const gamesWithRolesAndCounts = await Promise.all(
      (games || []).map(async (game) =>
      {
        const membership = memberships.find(m => m.team_id === game.team_id);

        // Get coaching points count for this game
        const { count: coachingPointsCount } = await supabase
          .from('coaching_points')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);

        return {
          ...game,
          user_role: membership?.role || 'player',
          coaching_points_count: coachingPointsCount || 0,
        };
      }),
    );

    res.json(gamesWithRolesAndCounts);
  }
  catch (error)
  {
    console.error('Get all games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new game for a team
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const {
      team_id,
      opponent,
      date,
      location,
      video_url,
      team_score,
      opp_score,
      game_type,
      home_away,
      notes,
    } = req.body;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!team_id || !opponent || !date)
    {
      res.status(400).json({ error: 'Team ID, opponent, and date are required' });
      return;
    }

    if (!video_url || !video_url.trim())
    {
      res.status(400).json({ error: 'Video URL is required' });
      return;
    }

    // Check if user has coach or admin role in the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership)
    {
      res.status(403).json({ error: 'User is not a member of this team' });
      return;
    }

    if (!['coach', 'admin'].includes(membership.role))
    {
      res.status(403).json({ error: 'Only coaches and admins can create games' });
      return;
    }

    // Parse and validate video URL
    const videoInfo = parseVideoInfo(video_url.trim());
    if (!videoInfo)
    {
      res.status(400).json({ error: 'Please provide a valid YouTube or HTML5 video URL' });
      return;
    }

    // For YouTube videos, validate they exist and are accessible
    if (videoInfo.type === 'youtube' && videoInfo.id)
    {
      const validationResult = await validateYouTubeVideo(videoInfo.id);
      if (!validationResult.isValid)
      {
        res.status(400).json({ error: validationResult.error || 'Invalid YouTube video' });
        return;
      }
    }

    let finalVideoUrl = videoInfo.url;
    let posterUrl: string | undefined;
    console.log('Final video URL:', finalVideoUrl);

    // If it's a VEO URL, parse it to get the actual video URL and poster
    if (videoInfo.type === 'veo')
    {
      try
      {
        const veoResult = await parseVeoVideo(video_url.trim());
        console.log('VEO parsing result:', veoResult);
        if ('error' in veoResult)
        {
          res.status(400).json({ error: `VEO parsing failed: ${veoResult.error}` });
          return;
        }
        finalVideoUrl = veoResult.videoUrl;
        posterUrl = veoResult.posterUrl;
        console.log('Parsed VEO video URL:', finalVideoUrl);
        console.log('Parsed VEO poster URL:', posterUrl);
      }
      catch (veoError)
      {
        console.error('VEO parsing error:', veoError);
        res.status(400).json({
          error: 'Failed to process VEO URL. Please try again or use a direct video URL.',
        });
        return;
      }
    }

    // Create the game first
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert({
        team_id,
        opponent,
        date,
        location: location || null,
        video_url: finalVideoUrl,
        video_id: videoInfo.type === 'youtube' ? videoInfo.id : null, // Keep for backward compatibility
        team_score: team_score !== undefined ? team_score : null,
        opp_score: opp_score !== undefined ? opp_score : null,
        game_type: game_type || 'regular',
        home_away: home_away || 'home',
        notes: notes || null,
      })
      .select()
      .single();

    if (gameError)
    {
      res.status(400).json({ error: gameError.message });
      return;
    }

    // Extract and store thumbnail (don't fail the game creation if this fails)
    try
    {
      const thumbnailResult = await extractAndStoreThumbnail(
        finalVideoUrl,
        videoInfo.type,
        gameData.id,
        posterUrl,
      );

      if ('error' in thumbnailResult)
      {
        console.warn('Thumbnail extraction failed:', thumbnailResult.error);
      }
      else
      {
        // Update game with thumbnail information
        await supabase
          .from('games')
          .update({
            thumbnail_url: thumbnailResult.thumbnailUrl,
            thumbnail_file_path: thumbnailResult.thumbnailFilePath,
          })
          .eq('id', gameData.id);
      }
    }
    catch (thumbnailError)
    {
      console.warn('Thumbnail processing failed:', thumbnailError);
      // Don't fail the game creation, just log the error
    }

    res.status(201).json({
      message: 'Game created successfully',
      game: gameData,
    });
  }
  catch (error)
  {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get games for a team
router.get('/team/:teamId', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { teamId } = req.params;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership)
    {
      res.status(403).json({ error: 'User is not a member of this team' });
      return;
    }

    // Get games for the team with team information
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        opponent,
        date,
        location,
        video_id,
        video_url,
        thumbnail_url,
        thumbnail_file_path,
        team_score,
        opp_score,
        game_type,
        home_away,
        notes,
        created_at,
        teams!inner(id, name)
      `)
      .eq('team_id', teamId)
      .order('date', { ascending: false });

    if (gamesError)
    {
      res.status(400).json({ error: gamesError.message });
      return;
    }

    // Add user role and coaching points count for each game
    const gamesWithRoleAndCounts = await Promise.all(
      (games || []).map(async (game) =>
      {
        // Get coaching points count for this game
        const { count: coachingPointsCount } = await supabase
          .from('coaching_points')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);

        return {
          ...game,
          user_role: membership.role,
          coaching_points_count: coachingPointsCount || 0,
        };
      }),
    );

    res.json(gamesWithRoleAndCounts);
  }
  catch (error)
  {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific game with coaching points count
router.get('/:gameId', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { gameId } = req.params;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get the game and verify user has access
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        team_id,
        opponent,
        date,
        location,
        video_id,
        team_score,
        opp_score,
        game_type,
        home_away,
        notes,
        created_at,
        teams!inner(id, name)
      `)
      .eq('id', gameId)
      .single();

    if (gameError || !game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership)
    {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get coaching points count for this game
    const { count: coachingPointsCount } = await supabase
      .from('coaching_points')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    res.json({
      ...game,
      coaching_points_count: coachingPointsCount || 0,
    });
  }
  catch (error)
  {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a game (coaches and admins only)
router.put('/:gameId', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { gameId } = req.params;
    const {
      opponent,
      date,
      location,
      video_url,
      team_score,
      opp_score,
      game_type,
      home_away,
      notes,
    } = req.body;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get the game and verify permissions
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('team_id, video_url, thumbnail_file_path')
      .eq('id', gameId)
      .single();

    if (gameError || !game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if user has coach or admin role in the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership)
    {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!['coach', 'admin'].includes(membership.role))
    {
      res.status(403).json({ error: 'Only coaches and admins can update games' });
      return;
    }

    if (!video_url || !video_url.trim())
    {
      res.status(400).json({ error: 'Video URL is required' });
      return;
    }

    // Parse and validate video URL
    const videoInfo = parseVideoInfo(video_url.trim());
    if (!videoInfo)
    {
      res.status(400).json({ error: 'Please provide a valid YouTube or HTML5 video URL' });
      return;
    }

    // For YouTube videos, validate they exist and are accessible
    if (videoInfo.type === 'youtube' && videoInfo.id)
    {
      const validationResult = await validateYouTubeVideo(videoInfo.id);
      if (!validationResult.isValid)
      {
        res.status(400).json({ error: validationResult.error || 'Invalid YouTube video' });
        return;
      }
    }

    let finalVideoUrl = videoInfo.url;
    let posterUrl: string | undefined;

    // If it's a VEO URL, parse it to get the actual video URL and poster
    if (videoInfo.type === 'veo')
    {
      try
      {
        const veoResult = await parseVeoVideo(video_url.trim());
        if ('error' in veoResult)
        {
          res.status(400).json({ error: `VEO parsing failed: ${veoResult.error}` });
          return;
        }
        finalVideoUrl = veoResult.videoUrl;
        posterUrl = veoResult.posterUrl;
      }
      catch (veoError)
      {
        console.error('VEO parsing error:', veoError);
        res.status(400).json({
          error: 'Failed to process VEO URL. Please try again or use a direct video URL.',
        });
        return;
      }
    }

    // Check if video URL changed to determine if we need to regenerate thumbnail
    const videoUrlChanged = game.video_url !== finalVideoUrl;

    // Update the game
    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update({
        opponent,
        date,
        location: location || null,
        video_url: finalVideoUrl,
        video_id: videoInfo.type === 'youtube' ? videoInfo.id : null, // Keep for backward compatibility
        team_score: team_score !== undefined ? team_score : null,
        opp_score: opp_score !== undefined ? opp_score : null,
        game_type: game_type || 'regular',
        home_away: home_away || 'home',
        notes: notes || null,
      })
      .eq('id', gameId)
      .select()
      .single();

    if (updateError)
    {
      res.status(400).json({ error: updateError.message });
      return;
    }

    // If video URL changed, regenerate thumbnail
    if (videoUrlChanged)
    {
      try
      {
        // Delete old thumbnail if it exists
        if (game.thumbnail_file_path)
        {
          await deleteThumbnail(game.thumbnail_file_path);
        }

        // Extract and store new thumbnail
        const thumbnailResult = await extractAndStoreThumbnail(
          finalVideoUrl,
          videoInfo.type,
          gameId,
          posterUrl,
        );

        if ('error' in thumbnailResult)
        {
          console.warn('Thumbnail extraction failed:', thumbnailResult.error);
          // Clear thumbnail fields since generation failed
          await supabase
            .from('games')
            .update({
              thumbnail_url: null,
              thumbnail_file_path: null,
            })
            .eq('id', gameId);
        }
        else
        {
          // Update game with new thumbnail information
          await supabase
            .from('games')
            .update({
              thumbnail_url: thumbnailResult.thumbnailUrl,
              thumbnail_file_path: thumbnailResult.thumbnailFilePath,
            })
            .eq('id', gameId);
        }
      }
      catch (thumbnailError)
      {
        console.warn('Thumbnail processing failed:', thumbnailError);
        // Don't fail the game update, just log the error
      }
    }

    res.json({
      message: 'Game updated successfully',
      game: updatedGame,
    });
  }
  catch (error)
  {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a game (coaches and admins only)
router.delete('/:gameId', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { gameId } = req.params;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get the game and verify permissions
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('team_id, thumbnail_file_path')
      .eq('id', gameId)
      .single();

    if (gameError || !game)
    {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Check if user has coach or admin role in the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', game.team_id)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership)
    {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!['coach', 'admin'].includes(membership.role))
    {
      res.status(403).json({ error: 'Only coaches and admins can delete games' });
      return;
    }

    // Delete thumbnail from storage if it exists
    if (game.thumbnail_file_path)
    {
      try
      {
        await deleteThumbnail(game.thumbnail_file_path);
      }
      catch (thumbnailError)
      {
        console.warn('Failed to delete thumbnail:', thumbnailError);
        // Don't fail the game deletion, just log the error
      }
    }

    // Delete the game (coaching points will be deleted by cascade)
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (deleteError)
    {
      res.status(400).json({ error: deleteError.message });
      return;
    }

    res.json({ message: 'Game deleted successfully' });
  }
  catch (error)
  {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
