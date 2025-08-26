// Video URL detection and validation utilities
import { isVeoUrl } from './veoUtils';

export interface VideoInfo
{
  type: 'youtube' | 'html5' | 'veo';
  id?: string; // For YouTube videos
  url: string; // Full URL
  originalUrl?: string; // For VEO URLs, store the original VEO URL
}

/**
 * Detects if a URL is a YouTube video
 */
export function isYouTubeUrl(url: string): boolean
{
  if (!url) return false;

  // Match YouTube URL patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  // Also match plain 11-character video IDs
  const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;

  return youtubePatterns.some(pattern => pattern.test(url)) || videoIdPattern.test(url);
}

/**
 * Detects if a URL is an HTML5 video file
 */
export function isHTML5VideoUrl(url: string): boolean
{
  if (!url) return false;

  try
  {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return /\.(mp4|webm|ogg|avi|mov)$/i.test(pathname);
  }
  catch
  {
    return false;
  }
}

/**
 * Detects if a URL is an MP4 video (legacy function for backward compatibility)
 */
export function isMp4Url(url: string): boolean
{
  if (!url) return false;

  try
  {
    const urlObj = new URL(url);
    return urlObj.pathname.toLowerCase().endsWith('.mp4');
  }
  catch
  {
    return false;
  }
}

/**
 * Extracts YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null
{
  if (!url) return null;

  // If it's already just a video ID, return it
  if (/^[a-zA-Z0-9_-]{11}$/.test(url))
  {
    return url;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns)
  {
    const match = url.match(pattern);
    if (match)
    {
      return match[1];
    }
  }

  return null;
}

/**
 * Normalizes a video URL/ID to a full URL
 */
export function normalizeVideoUrl(input: string): string | null
{
  if (!input) return null;

  if (isYouTubeUrl(input))
  {
    const videoId = extractYouTubeId(input);
    if (!videoId) return null;
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  if (isHTML5VideoUrl(input))
  {
    return input;
  }

  return null;
}

/**
 * Parses video info from a URL or ID
 */
export function parseVideoInfo(input: string): VideoInfo | null
{
  if (!input) return null;

  if (isYouTubeUrl(input))
  {
    const videoId = extractYouTubeId(input);
    if (!videoId) return null;

    return {
      type: 'youtube',
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (isHTML5VideoUrl(input))
  {
    return {
      type: 'html5',
      url: input,
    };
  }

  // VEO support temporarily disabled due to server dependency issues
  if (isVeoUrl(input))
  {
    return null;
    // return {
    //   type: 'veo',
    //   url: input, // Initially use the VEO URL, will be replaced after parsing
    //   originalUrl: input,
    // };
  }

  return null;
}

/**
 * Validates an MP4 URL by checking if it's accessible
 * NOTE: This function requires a fetch implementation and should only be used in environments where fetch is available (Node.js with node-fetch or browsers)
 */
export async function validateMp4Url(url: string): Promise<{ isValid: boolean; error?: string; }>
{
  try
  {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok)
    {
      return { isValid: false, error: `MP4 URL returned ${response.status}: ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('video/'))
    {
      return { isValid: false, error: 'URL does not point to a video file' };
    }

    return { isValid: true };
  }
  catch (error)
  {
    return {
      isValid: false,
      error: `Failed to validate MP4 URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
