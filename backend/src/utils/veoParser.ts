// VEO video URL parser utility
import { type Browser, chromium, type Page } from 'playwright';

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

// Browser instance management for performance
let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance for Playwright
 */
async function getBrowser()
{
  if (!browserInstance)
  {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

/**
 * Clean up browser instance
 */
export async function closeBrowser()
{
  if (browserInstance)
  {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Validates if a URL is a VEO match URL
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
 * Parses a VEO match page using Playwright to handle JavaScript-rendered content
 */
async function parseVeoVideoWithPlaywright(url: string): Promise<VeoParseResult | VeoParseError>
{
  let page: Page | undefined;
  try
  {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set user agent and viewport
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to the VEO page
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for potential video elements to load
    await page.waitForSelector('body', { timeout: 5000 }).catch(() =>
    {});
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to find video elements in the rendered DOM
    const videoData = await page.evaluate(() =>
    {
      // Look for video elements
      const videos = document.querySelectorAll('video');
      for (const video of videos)
      {
        const src = video.src || video.currentSrc;
        const poster = video.poster;

        if (src && (src.includes('.mp4') || src.includes('veocdn.com')))
        {
          return {
            videoUrl: src,
            posterUrl: poster || '',
          };
        }
      }

      // Look for source elements
      const sources = document.querySelectorAll('source');
      for (const source of sources)
      {
        const src = source.src;
        if (src && (src.includes('.mp4') || src.includes('veocdn.com')))
        {
          // Try to find poster from parent video element
          const parentVideo = source.closest('video');
          const poster = parentVideo?.poster || '';

          return {
            videoUrl: src,
            posterUrl: poster,
          };
        }
      }

      // Look for data attributes or JavaScript variables
      const bodyText = document.body.innerText;
      const bodyHTML = document.body.innerHTML;

      // Search for veocdn URLs in the page content
      const veocdnMatches = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]*\.mp4/gi);
      if (veocdnMatches && veocdnMatches.length > 0)
      {
        const videoUrl = veocdnMatches[0];

        // Look for poster URLs
        const posterMatches = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]*\.(jpg|jpeg|png|webp)/gi);
        const posterUrl = posterMatches && posterMatches.length > 0 ? posterMatches[0] : '';

        return {
          videoUrl,
          posterUrl,
        };
      }

      return null;
    });

    if (videoData)
    {
      return videoData;
    }

    return {
      error: 'Could not find video elements in the rendered VEO page',
      details: 'Video content may require user interaction or authentication to load',
    };
  }
  catch (error)
  {
    console.error('Playwright parsing error:', error);
    return {
      error: 'Failed to parse VEO page with Playwright',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  finally
  {
    if (page)
    {
      await page.close();
    }
  }
}

/**
 * Parses a VEO match page to extract video and poster URLs
 * Uses a hybrid approach: fast regex parsing first, then Playwright if needed
 */
export async function parseVeoVideo(url: string): Promise<VeoParseResult | VeoParseError>
{
  // Validate URL format
  if (!isVeoUrl(url))
  {
    return {
      error: 'Invalid VEO URL format. Expected format: https://app.veo.co/matches/...',
    };
  }

  try
  {
    // Step 1: Try fast regex-based parsing first
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok)
    {
      return {
        error: `Failed to fetch VEO page: ${response.status} ${response.statusText}`,
        details: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();

    // Try regex parsing first (fast)
    const regexResult = parseVideoFromHtml(html);

    if (!('error' in regexResult))
    {
      return regexResult;
    }

    // Step 2: If regex parsing fails, use Playwright
    const playwrightResult = await parseVeoVideoWithPlaywright(url);

    return playwrightResult;
  }
  catch (error)
  {
    console.error('VEO parsing error:', error);
    return {
      error: 'Failed to parse VEO video',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extracts video and poster URLs from HTML content
 */
function parseVideoFromHtml(html: string): VeoParseResult | VeoParseError
{
  // VEO pages are JavaScript applications, so we need to look for different patterns

  // Method 1: Look for video elements with src and poster attributes
  const videoRegex = /<video[^>]*>/gi;
  const videoMatches = html.match(videoRegex);

  if (videoMatches && videoMatches.length > 0)
  {
    // Extract src and poster from the first video element
    for (const videoMatch of videoMatches)
    {
      const srcMatch = videoMatch.match(/src=["']([^"']+)["']/i);
      const posterMatch = videoMatch.match(/poster=["']([^"']+)["']/i);

      if (srcMatch)
      {
        const videoUrl = srcMatch[1];
        const posterUrl = posterMatch ? posterMatch[1] : '';

        // Validate that we found a reasonable video URL
        if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('veocdn.com')))
        {
          return {
            videoUrl,
            posterUrl,
          };
        }
      }
    }
  }

  // Method 2: Look for source elements
  const sourceRegex = /<source[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const sourceMatches = html.match(sourceRegex);

  if (sourceMatches)
  {
    for (const sourceMatch of sourceMatches)
    {
      const srcMatch = sourceMatch.match(/src=["']([^"']+)["']/i);
      if (srcMatch)
      {
        const videoUrl = srcMatch[1];
        if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('veocdn.com')))
        {
          // Look for poster in nearby video element
          const posterRegex = /poster=["']([^"']+)["']/i;
          const posterMatch = html.match(posterRegex);
          const posterUrl = posterMatch ? posterMatch[1] : '';

          return {
            videoUrl,
            posterUrl,
          };
        }
      }
    }
  }

  // Method 3: Look for embedded video URLs in JavaScript or data attributes
  // Pattern: look for veocdn.com URLs in the page source
  // This covers the pattern: https://c.veocdn.com/e1b45af3-530e-48c8-ad61-96b312908e4c/standard/machine/f9f8ca4f/video.mp4
  const veocdnRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]*\.mp4/gi;
  const veocdnMatches = html.match(veocdnRegex);

  if (veocdnMatches && veocdnMatches.length > 0)
  {
    const videoUrl = veocdnMatches[0];

    // Look for poster URL patterns (JPG/PNG from veocdn)
    const posterRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]*\.(jpg|jpeg|png|webp)/gi;
    const posterMatches = html.match(posterRegex);
    const posterUrl = posterMatches && posterMatches.length > 0 ? posterMatches[0] : '';

    return {
      videoUrl,
      posterUrl,
    };
  }

  // Method 3b: More general veocdn pattern
  const veocdnGeneralRegex = /https:\/\/[^"'\s]*veocdn\.com[^"'\s]*\.mp4/gi;
  const veocdnGeneralMatches = html.match(veocdnGeneralRegex);

  if (veocdnGeneralMatches && veocdnGeneralMatches.length > 0)
  {
    const videoUrl = veocdnGeneralMatches[0];

    // Look for poster URL patterns (JPG/PNG from veocdn)
    const posterGeneralRegex = /https:\/\/[^"'\s]*veocdn\.com[^"'\s]*\.(jpg|jpeg|png|webp)/gi;
    const posterGeneralMatches = html.match(posterGeneralRegex);
    const posterUrl = posterGeneralMatches && posterGeneralMatches.length > 0 ? posterGeneralMatches[0] : '';

    return {
      videoUrl,
      posterUrl,
    };
  }

  // Method 4: Look for any .mp4 URLs that might be video sources
  const mp4Regex = /https:\/\/[^"'\s]*\.mp4[^"'\s]*/gi;
  const mp4Matches = html.match(mp4Regex);

  if (mp4Matches && mp4Matches.length > 0)
  {
    const videoUrl = mp4Matches[0];

    // Look for any image URLs that might be posters
    const imageRegex = /https:\/\/[^"'\s]*\.(jpg|jpeg|png|webp)[^"'\s]*/gi;
    const imageMatches = html.match(imageRegex);
    const posterUrl = imageMatches && imageMatches.length > 0 ? imageMatches[0] : '';

    return {
      videoUrl,
      posterUrl,
    };
  }

  // Method 5: Look for JSON data that might contain video information
  const jsonRegex = /"videoUrl":\s*"([^"]+)"/gi;
  const jsonMatch = jsonRegex.exec(html);
  if (jsonMatch)
  {
    const videoUrl = jsonMatch[1];

    // Look for posterUrl in the same JSON
    const posterJsonRegex = /"posterUrl":\s*"([^"]+)"/gi;
    const posterJsonMatch = posterJsonRegex.exec(html);
    const posterUrl = posterJsonMatch ? posterJsonMatch[1] : '';

    return {
      videoUrl,
      posterUrl,
    };
  }

  return {
    error: 'Could not extract video URL from VEO page',
    details:
      'This VEO page appears to be a JavaScript application. The video content may be loaded dynamically and not accessible via simple HTML parsing. You may need to access the VEO page directly in a browser to get the video URL.',
  };
}
