import { Response, Router } from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth.js';
import { parseVeoVideo } from '../utils/veoParser.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Parse VEO video URL to extract video and poster URLs
router.post('/parse', async (req: AuthenticatedRequest, res: Response): Promise<void> =>
{
  try
  {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!userId)
    {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!url || typeof url !== 'string')
    {
      res.status(400).json({ error: 'URL is required and must be a string' });
      return;
    }

    // Parse the VEO video
    const result = await parseVeoVideo(url.trim());

    if ('error' in result)
    {
      // Add some debugging information
      console.log(`VEO parse failed for URL: ${url.trim()}`);
      console.log(`Error: ${result.error}`);
      console.log(`Details: ${result.details}`);

      res.status(400).json({
        error: result.error,
        details: result.details,
      });
      return;
    }

    console.log(`VEO parse successful for URL: ${url.trim()}`);
    console.log(`Video URL: ${result.videoUrl}`);
    console.log(`Poster URL: ${result.posterUrl}`);

    res.json({
      success: true,
      data: {
        originalUrl: url.trim(),
        videoUrl: result.videoUrl,
        posterUrl: result.posterUrl,
      },
    });
  }
  catch (error)
  {
    console.error('VEO parse error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
