// VEO video URL parser utility
import puppeteer from 'puppeteer';

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
let browserInstance: any = null;

/**
 * Get or create a browser instance for Puppeteer
 */
async function getBrowser()
{
  // Check if browser instance is still connected
  if (browserInstance && !browserInstance.isConnected())
  {
    browserInstance = null;
  }

  if (!browserInstance)
  {
    browserInstance = await puppeteer.launch({
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

    // Handle browser disconnection
    browserInstance.on('disconnected', () => {
      browserInstance = null;
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
    try
    {
      if (browserInstance.isConnected())
      {
        await browserInstance.close();
      }
    }
    catch (error)
    {
      console.warn('Error closing browser:', error);
    }
    finally
    {
      browserInstance = null;
    }
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
 * Parses a VEO match page using Puppeteer to handle JavaScript-rendered content
 * Uses a fresh browser instance for each request to avoid connection issues
 */
async function parseVeoVideoWithPuppeteer(url: string, retryCount = 0): Promise<VeoParseResult | VeoParseError>
{
  const maxRetries = 2;
  let page;
  let browser;
  
  try
  {
    // Always create a fresh browser instance to avoid frame detachment issues
    browser = await puppeteer.launch({
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
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    page = await browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Set a reasonable timeout for navigation
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for the page to stabilize and load dynamic content
    await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});
    
    // Wait for potential dynamic content and iframes to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Wait for network to be mostly idle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try multiple approaches to find video data, handling frame issues
    let videoData = null;
    
    // Approach 1: Try to get page content first (safest)
    try {
      const content = await page.content();
      const regexResult = parseVideoFromHtml(content);
      if (!('error' in regexResult)) {
        videoData = regexResult;
      }
    } catch (contentError) {
      console.warn('Failed to get page content:', contentError);
    }
    
    // Approach 2: If regex parsing didn't work, try DOM evaluation with better error handling
    if (!videoData) {
      try {
        videoData = await page.evaluate(() => {
          try {
            // Look for video elements
            const videos = document.querySelectorAll('video');
            for (const video of videos) {
              try {
                const src = video.src || video.currentSrc;
                const poster = video.poster;

                if (src && (src.includes('.mp4') || src.includes('veocdn.com'))) {
                  return {
                    videoUrl: src,
                    posterUrl: poster || '',
                  };
                }
              } catch (videoError) {
                continue;
              }
            }

            // Look for source elements
            const sources = document.querySelectorAll('source');
            for (const source of sources) {
              try {
                const src = source.src;
                if (src && (src.includes('.mp4') || src.includes('veocdn.com'))) {
                  const parentVideo = source.closest('video');
                  const poster = parentVideo?.poster || '';
                  return { videoUrl: src, posterUrl: poster };
                }
              } catch (sourceError) {
                continue;
              }
            }

            // Look for veocdn URLs in page content
            const bodyHTML = document.body?.innerHTML || '';
            const veocdnMatches = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]*\.mp4/gi);
            if (veocdnMatches && veocdnMatches.length > 0) {
              const videoUrl = veocdnMatches[0];
              const posterMatches = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]*\.(jpg|jpeg|png|webp)/gi);
              const posterUrl = posterMatches?.[0] || '';
              return { videoUrl, posterUrl };
            }

            return null;
          } catch (error) {
            return null;
          }
        });
      } catch (evalError) {
        console.warn('DOM evaluation failed:', evalError);
        videoData = null;
      }
    }

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
    console.error('Puppeteer parsing error:', error);
    
    // Check if this is a detached frame error and we can retry
    if (error instanceof Error && 
        error.message.includes('detached Frame') && 
        retryCount < maxRetries)
    {
      console.warn(`Retrying due to detached frame error. Attempt ${retryCount + 1}/${maxRetries + 1}`);
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return parseVeoVideoWithPuppeteer(url, retryCount + 1);
    }
    
    return {
      error: 'Failed to parse VEO page with Puppeteer',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  finally
  {
    // Safely close page
    if (page) {
      try {
        // Check if page is still valid before closing
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        // Ignore close errors as they often happen with detached frames
        const errorMsg = closeError instanceof Error ? closeError.message : 'Unknown error';
        console.warn('Page close warning (can be ignored):', errorMsg);
      }
    }
    
    // Always close the browser since we create a fresh one each time
    if (browser) {
      try {
        if (browser.isConnected()) {
          await browser.close();
        }
      } catch (browserCloseError) {
        const errorMsg = browserCloseError instanceof Error ? browserCloseError.message : 'Unknown error';
        console.warn('Browser close warning (can be ignored):', errorMsg);
      }
    }
  }
}

/**
 * Parses a VEO match page to extract video and poster URLs
 * Uses a hybrid approach: fast regex parsing first, then Puppeteer if needed
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

    // Step 2: If regex parsing fails, use Puppeteer
    const puppeteerResult = await parseVeoVideoWithPuppeteer(url);

    return puppeteerResult;
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