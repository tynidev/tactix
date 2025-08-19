/**
 * YouTube video validation utility
 * Uses YouTube oEmbed API to check if a video exists and is accessible
 */

import { isYouTubeUrl } from '../utils/videoUtils.js';

interface YouTubeValidationResult
{
  isValid: boolean;
  error?: string;
}

/**
 * Validates if a YouTube video exists and is accessible
 * @param videoId The YouTube video ID to validate
 * @returns Promise with validation result
 */
export async function validateYouTubeVideo(videoId: string): Promise<YouTubeValidationResult>
{
  if (!videoId || videoId.trim().length === 0)
  {
    return {
      isValid: false,
      error: 'Video ID is required',
    };
  }

  // Use shared utility to validate YouTube video ID format
  if (!isYouTubeUrl(videoId.trim()))
  {
    return {
      isValid: false,
      error: 'Invalid YouTube video ID format',
    };
  }

  try
  {
    // Use YouTube oEmbed API to check if video exists and is accessible
    const oembedUrl =
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId.trim()}&format=json`;

    // Set a 5-second timeout for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(oembedUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TACTIX-App/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok)
    {
      const data = await response.json();

      // Check if we got valid oEmbed data
      if (data && data.type === 'video' && data.title)
      {
        return {
          isValid: true,
        };
      }
      else
      {
        return {
          isValid: false,
          error: 'Video data could not be retrieved',
        };
      }
    }
    else if (response.status === 401)
    {
      return {
        isValid: false,
        error: 'Video is private or restricted',
      };
    }
    else if (response.status === 404)
    {
      return {
        isValid: false,
        error: 'Video not found',
      };
    }
    else
    {
      return {
        isValid: false,
        error: 'Video could not be accessed',
      };
    }
  }
  catch (error)
  {
    console.error('YouTube validation error:', error);

    if (error instanceof Error)
    {
      if (error.name === 'AbortError')
      {
        return {
          isValid: false,
          error: 'Video validation timed out',
        };
      }
    }

    return {
      isValid: false,
      error: 'Failed to validate video accessibility',
    };
  }
}
