import { supabase } from './supabase.js';
import { extractYouTubeId } from './videoUtils.js';

export interface ThumbnailResult
{
  thumbnailUrl: string;
  thumbnailFilePath: string | null;
}

export interface ThumbnailError
{
  error: string;
  details?: string;
}

/**
 * Get YouTube thumbnail URL with fallback options
 */
function getYouTubeThumbnailUrl(videoId: string): string[]
{
  return [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
  ];
}

/**
 * Download image from URL and convert to buffer
 */
async function downloadImage(url: string): Promise<Buffer>
{
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TACTIX-App/1.0',
    },
  });

  if (!response.ok)
  {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload image buffer to Supabase storage
 */
async function uploadThumbnail(
  imageBuffer: Buffer,
  fileName: string,
  contentType: string = 'image/jpeg',
): Promise<string>
{
  console.log('Uploading thumbnail to storage with filename:', fileName);
  const { data, error } = await supabase.storage
    .from('game-thumbnails')
    .upload(fileName, imageBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error)
  {
    throw new Error(`Failed to upload thumbnail: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('game-thumbnails')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Generate unique filename for thumbnail
 */
function generateThumbnailFileName(gameId: string, videoType: string): string
{
  const timestamp = Date.now();
  return `${gameId}/${videoType}_${timestamp}.jpg`;
}

/**
 * Process YouTube thumbnail
 */
async function processYouTubeThumbnail(videoId: string, gameId: string): Promise<ThumbnailResult>
{
  const thumbnailUrls = getYouTubeThumbnailUrl(videoId);
  let lastError: Error | null = null;

  // Try each thumbnail URL until one works
  for (const thumbnailUrl of thumbnailUrls)
  {
    try
    {
      const imageBuffer = await downloadImage(thumbnailUrl);
      const fileName = generateThumbnailFileName(gameId, 'youtube');
      const filePath = await uploadThumbnail(imageBuffer, fileName);

      return {
        thumbnailUrl,
        thumbnailFilePath: filePath,
      };
    }
    catch (error)
    {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Failed to process YouTube thumbnail from ${thumbnailUrl}:`, error);
      continue;
    }
  }

  // If all thumbnail URLs failed, return just the URL without storing
  console.warn('All YouTube thumbnail downloads failed, storing URL only');
  return {
    thumbnailUrl: thumbnailUrls[0], // Use the highest quality URL as fallback
    thumbnailFilePath: null,
  };
}

/**
 * Process VEO thumbnail from poster URL
 */
async function processVeoThumbnail(posterUrl: string, gameId: string): Promise<ThumbnailResult>
{
  if (!posterUrl || posterUrl.trim() === '')
  {
    throw new Error('No VEO poster URL provided');
  }

  try
  {
    const imageBuffer = await downloadImage(posterUrl);
    const fileName = generateThumbnailFileName(gameId, 'veo');
    const filePath = await uploadThumbnail(imageBuffer, fileName);

    return {
      thumbnailUrl: posterUrl,
      thumbnailFilePath: filePath,
    };
  }
  catch (error)
  {
    console.warn('Failed to process VEO thumbnail, storing URL only:', error);
    return {
      thumbnailUrl: posterUrl,
      thumbnailFilePath: null,
    };
  }
}

/**
 * Extract and store thumbnail for a video URL
 */
export async function extractAndStoreThumbnail(
  videoUrl: string,
  videoType: 'youtube' | 'veo' | 'html5',
  gameId: string,
  posterUrl?: string,
): Promise<ThumbnailResult | ThumbnailError>
{
  try
  {
    console.log('Extracting thumbnail for video:', videoUrl);
    console.log('Video type:', videoType);
    switch (videoType)
    {
      case 'youtube':
      {
        const videoId = extractYouTubeId(videoUrl);
        if (!videoId)
        {
          return { error: 'Could not extract YouTube video ID' };
        }
        return await processYouTubeThumbnail(videoId, gameId);
      }

      case 'veo':
      {
        if (!posterUrl)
        {
          return { error: 'VEO poster URL is required' };
        }
        return await processVeoThumbnail(posterUrl, gameId);
      }

      case 'html5':
      {
        // For HTML5 videos, we don't have a standard way to extract thumbnails
        // Return empty result - no thumbnail support for direct video files yet
        return {
          thumbnailUrl: '',
          thumbnailFilePath: null,
        };
      }

      default:
      {
        return { error: 'Unsupported video type for thumbnail extraction' };
      }
    }
  }
  catch (error)
  {
    console.error('Thumbnail extraction error:', error);
    return {
      error: 'Failed to extract and store thumbnail',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete thumbnail file from storage
 */
export async function deleteThumbnail(thumbnailFilePath: string): Promise<void>
{
  if (!thumbnailFilePath) return;

  try
  {
    const { error } = await supabase.storage
      .from('game-thumbnails')
      .remove([thumbnailFilePath]);

    if (error)
    {
      console.error('Failed to delete thumbnail:', error);
      // Don't throw error - deletion failure shouldn't break the main operation
    }
  }
  catch (error)
  {
    console.error('Error deleting thumbnail:', error);
    // Don't throw error - deletion failure shouldn't break the main operation
  }
}

/**
 * Get public URL for stored thumbnail
 */
export function getThumbnailPublicUrl(thumbnailFilePath: string): string | null
{
  if (!thumbnailFilePath) return null;

  try
  {
    const { data } = supabase.storage
      .from('game-thumbnails')
      .getPublicUrl(thumbnailFilePath);

    return data.publicUrl;
  }
  catch (error)
  {
    console.error('Error getting thumbnail public URL:', error);
    return null;
  }
}
