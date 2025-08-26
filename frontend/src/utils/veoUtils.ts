// VEO URL utilities for frontend

/**
 * Detects if a URL is a VEO match URL
 */
export function isVeoUrl(url: string): boolean
{
  if (!url) return false;

  try
  {
    const urlObj = new URL(url);
    return urlObj.hostname === 'app.veo.co' && urlObj.pathname.includes('/matches/');
  }
  catch
  {
    return false;
  }
}

/**
 * Parse VEO URL to get the actual video URL
 */
export interface VeoParseResult
{
  videoUrl: string;
  posterUrl: string;
}

export interface VeoParseError
{
  error: string;
  details?: string;
}

/**
 * Parse a VEO URL by calling the backend API
 */
export async function parseVeoUrl(
  url: string,
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<Response>,
): Promise<VeoParseResult>
{
  try
  {
    const response = await apiRequest('/api/veo/parse', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    if (!response.ok)
    {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to parse VEO URL');
    }

    const result = await response.json();
    return {
      videoUrl: result.data.videoUrl,
      posterUrl: result.data.posterUrl,
    };
  }
  catch (error)
  {
    throw new Error(error instanceof Error ? error.message : 'Failed to parse VEO URL');
  }
}
