// VEO video URL parser utility
import puppeteer, { Page, Browser } from 'puppeteer';

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
 * Safe wrapper for page operations that handles detached frame errors
 */
async function safePageOperation<T>(
  page: Page, 
  operation: () => Promise<T>, 
  operationName: string,
  maxRetries = 3
): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check if page is still valid
      if (page.isClosed()) {
        console.warn(`Page is closed during ${operationName}, attempt ${attempt + 1}`);
        return null;
      }
      
      return await operation();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('detached Frame') || 
          errorMessage.includes('Target closed') ||
          errorMessage.includes('Session closed')) {
        console.warn(`${operationName} failed due to frame detachment, attempt ${attempt + 1}/${maxRetries + 1}: ${errorMessage}`);
        
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
      }
      
      // If it's not a frame detachment error or we've exhausted retries, throw
      console.error(`${operationName} failed:`, error);
      throw error;
    }
  }
  
  return null;
}

/**
 * Wait for page stability by monitoring network activity and DOM changes
 */
async function waitForPageStability(page: Page, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    let networkIdleTimer: NodeJS.Timeout;
    let requestCount = 0;
    let responseCount = 0;
    const startTime = Date.now();
    
    const checkStability = () => {
      if (Date.now() - startTime > timeoutMs) {
        console.log('Page stability timeout reached');
        resolve();
        return;
      }
      
      if (requestCount === responseCount) {
        clearTimeout(networkIdleTimer);
        networkIdleTimer = setTimeout(() => {
          console.log('Page appears stable (network idle)');
          resolve();
        }, 1000);
      }
    };
    
    page.on('request', () => {
      requestCount++;
      clearTimeout(networkIdleTimer);
    });
    
    page.on('response', () => {
      responseCount++;
      checkStability();
    });
    
    page.on('requestfailed', () => {
      responseCount++;
      checkStability();
    });
    
    // Initial check in case there are no pending requests
    setTimeout(checkStability, 100);
  });
}

/**
 * Parses a VEO match page using Puppeteer to handle JavaScript-rendered content
 * Uses improved error handling and frame stability measures
 */
async function parseVeoVideoWithPuppeteer(url: string, retryCount = 0): Promise<VeoParseResult | VeoParseError>
{
  const maxRetries = 2;
  let page: Page | undefined;
  let browser: Browser | undefined;
  
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
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
      ],
    });

    page = await browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Enhanced navigation with better wait conditions
    console.log('🚀 [VEO Parser] Navigating to page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('⏳ [VEO Parser] Waiting for page stability...');
    await waitForPageStability(page, 15000);
    
    // Wait for essential elements with safe operation wrapper
    console.log('🔍 [VEO Parser] Waiting for essential elements...');
    await safePageOperation(
      page,
      () => Promise.race([
        page!.waitForSelector('video', { timeout: 10000 }).catch(() => {}),
        page!.waitForSelector('source', { timeout: 10000 }).catch(() => {}),
        page!.waitForSelector('[src*="veocdn"]', { timeout: 10000 }).catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 10000))
      ]),
      'waiting for video elements'
    );

    // Try to simulate user interaction safely
    console.log('🎯 [VEO Parser] Attempting user interaction...');
    const interactionResult = await safePageOperation(
      page,
      () => page!.evaluate(() => {
        // Look for common play button selectors
        const playSelectors = [
          'button[aria-label*="play"]',
          'button[title*="play"]',
          '.play-button',
          '.video-play',
          '[data-testid*="play"]',
          'button:has(svg)',
          '.video-container button',
        ];
        
        for (const selector of playSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            try {
              (element as HTMLElement).click();
              return true;
            } catch {}
          }
        }
        
        // Try clicking on video elements themselves
        const videos = document.querySelectorAll('video, .video-player, [class*="video"]');
        for (const video of videos) {
          try {
            (video as HTMLElement).click();
          } catch {}
        }
        
        return false;
      }),
      'user interaction simulation'
    );
    
    if (interactionResult) {
      console.log('✅ [VEO Parser] User interaction successful');
      // Wait for potential content changes after interaction
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Try multiple approaches to find video data with safe operations
    let videoData = null;
    
    // Approach 1: Try to get page content first (safest)
    console.log('📄 [VEO Parser] Attempting to get page content...');
    const content = await safePageOperation(
      page,
      () => page!.content(),
      'getting page content'
    );
    
    if (content) {
      const regexResult = parseVideoFromHtml(content);
      if (!('error' in regexResult)) {
        console.log('✅ [VEO Parser] Successfully parsed video from HTML content');
        videoData = regexResult;
      }
    }
    
    // Approach 2: If regex parsing didn't work, try DOM evaluation with safe operation
    if (!videoData) {
      console.log('🎭 [VEO Parser] Attempting DOM evaluation...');
      videoData = await safePageOperation(
        page,
        () => page!.evaluate(() => {
          console.log('🎭 [VEO Parser] DOM Evaluation: Starting...');
          
          // Simple approach - just find the video element and its source
          const video = document.querySelector('video');
          console.log('🎭 [VEO Parser] DOM Evaluation: Video element found:', !!video);
          
          if (video) {
            const source = video.querySelector('source');
            console.log('🎭 [VEO Parser] DOM Evaluation: Source element found:', !!source);
            
            if (source && source.src) {
              console.log('🎉 [VEO Parser] DOM Evaluation: SUCCESS - Found video and poster');
              return {
                videoUrl: source.src,
                posterUrl: video.poster || '',
              };
            }
          }
          
          // Fallback: look for any veocdn URLs in the page
          console.log('🎭 [VEO Parser] DOM Evaluation: Fallback - searching HTML for veocdn URLs...');
          const bodyHTML = document.body?.innerHTML || '';
          
          const veocdnMatch = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.mp4/i);
          
          if (veocdnMatch) {
            const videoUrl = veocdnMatch[0];
            const posterMatch = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.jpg/i);
            const posterUrl = posterMatch ? posterMatch[0] : '';
            
            console.log('🎉 [VEO Parser] DOM Evaluation: SUCCESS via fallback');
            return {
              videoUrl,
              posterUrl,
            };
          }
          
          console.log('❌ [VEO Parser] DOM Evaluation: All methods failed');
          return null;
        }),
        'DOM evaluation'
      );
    }

    if (videoData && videoData.videoUrl)
    {
      console.log('🎉 [VEO Parser] Successfully extracted video data');
      return videoData;
    }

    console.log('❌ [VEO Parser] Could not find video elements');
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
        (error.message.includes('detached Frame') || 
         error.message.includes('Target closed') ||
         error.message.includes('Session closed')) && 
        retryCount < maxRetries)
    {
      console.warn(`🔄 [VEO Parser] Retrying due to frame/session error. Attempt ${retryCount + 1}/${maxRetries + 1}`);
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      
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
  console.log(`🚀 [VEO Parser] Starting parse for URL: ${url}`);
  
  // Validate URL format
  if (!isVeoUrl(url))
  {
    console.log('❌ [VEO Parser] Invalid URL format');
    return {
      error: 'Invalid VEO URL format. Expected format: https://app.veo.co/matches/...',
    };
  }

  console.log('✅ [VEO Parser] URL format is valid');

  try
  {
    // Step 1: Try fast regex-based parsing first
    console.log('� [VEO Parser] Step 1: Fetching page HTML...');
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok)
    {
      console.log(`❌ [VEO Parser] HTTP error: ${response.status} ${response.statusText}`);
      return {
        error: `Failed to fetch VEO page: ${response.status} ${response.statusText}`,
        details: `HTTP ${response.status}`,
      };
    }

    console.log('✅ [VEO Parser] Page fetched successfully');
    const html = await response.text();
    console.log(`�� [VEO Parser] HTML received: ${html.length} characters`);

    // Try regex parsing first (fast)
    console.log('🔍 [VEO Parser] Step 2: Trying regex-based parsing...');
    const regexResult = parseVideoFromHtml(html);

    if (!('error' in regexResult))
    {
      console.log('🎉 [VEO Parser] SUCCESS with regex parsing!');
      console.log(`📹 [VEO Parser] Video URL: ${regexResult.videoUrl}`);
      console.log(`🖼️ [VEO Parser] Poster URL: ${regexResult.posterUrl}`);
      return regexResult;
    }

    console.log('⚠️ [VEO Parser] Regex parsing failed, trying Puppeteer...');
    console.log(`🔍 [VEO Parser] Regex error: ${regexResult.error}`);

    // Step 2: If regex parsing fails, use Puppeteer
    console.log('🎭 [VEO Parser] Step 3: Starting Puppeteer parsing...');
    const puppeteerResult = await parseVeoVideoWithPuppeteer(url);

    if (!('error' in puppeteerResult)) {
      console.log('🎉 [VEO Parser] SUCCESS with Puppeteer parsing!');
      console.log(`📹 [VEO Parser] Video URL: ${puppeteerResult.videoUrl}`);
      console.log(`🖼️ [VEO Parser] Poster URL: ${puppeteerResult.posterUrl}`);
    } else {
      console.log('❌ [VEO Parser] Puppeteer parsing also failed');
      console.log(`🔍 [VEO Parser] Puppeteer error: ${puppeteerResult.error}`);
    }

    return puppeteerResult;
  }
  catch (error)
  {
    console.error('💥 [VEO Parser] Unexpected error:', error);
    return {
      error: 'Failed to parse VEO video',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extracts video and poster URLs from HTML content - simplified approach with debug logging
 */
function parseVideoFromHtml(html: string): VeoParseResult | VeoParseError
{
  console.log('🔍 [VEO Parser] Starting HTML parsing...');
  console.log(`📄 [VEO Parser] HTML length: ${html.length} characters`);
  
  // VEO has a single video element with this structure:
  // <video...poster="POSTER_URL"><source src="VIDEO_URL" type="video/mp4"></video>
  
  // Method 1: Simple regex to find the video element and extract poster
  console.log('🎯 [VEO Parser] Method 1: Looking for video element with poster...');
  const videoElementRegex = /<video[^>]*poster=["']([^"']+)["'][^>]*>/i;
  const videoMatch = html.match(videoElementRegex);
  
  if (videoMatch) {
    const posterUrl = videoMatch[1];
    console.log(`✅ [VEO Parser] Found video element with poster: ${posterUrl}`);
    
    // Now find the source element within the video
    console.log('🎯 [VEO Parser] Looking for source element...');
    const sourceRegex = /<source[^>]*src=["']([^"']+\.mp4[^"']*)["'][^>]*type=["']video\/mp4["'][^>]*>/i;
    const sourceMatch = html.match(sourceRegex);
    
    if (sourceMatch) {
      const videoUrl = sourceMatch[1];
      console.log(`✅ [VEO Parser] Found source element with video URL: ${videoUrl}`);
      console.log('🎉 [VEO Parser] Method 1 SUCCESS - Returning video and poster URLs');
      return {
        videoUrl,
        posterUrl,
      };
    } else {
      console.log('❌ [VEO Parser] No source element found with Method 1');
      // Try a more flexible source regex
      const flexibleSourceRegex = /<source[^>]*src=["']([^"']+\.mp4[^"']*)["'][^>]*>/i;
      const flexibleSourceMatch = html.match(flexibleSourceRegex);
      if (flexibleSourceMatch) {
        const videoUrl = flexibleSourceMatch[1];
        console.log(`✅ [VEO Parser] Found source element with flexible regex: ${videoUrl}`);
        return {
          videoUrl,
          posterUrl,
        };
      }
    }
  } else {
    console.log('❌ [VEO Parser] No video element with poster found');
    
    // Debug: Check if there's any video element at all
    const anyVideoRegex = /<video[^>]*>/i;
    const anyVideoMatch = html.match(anyVideoRegex);
    if (anyVideoMatch) {
      console.log(`🔍 [VEO Parser] DEBUG: Found video element without poster: ${anyVideoMatch[0]}`);
    } else {
      console.log('🔍 [VEO Parser] DEBUG: No video element found at all');
    }
  }
  
  // Method 2: Even simpler - just look for any veocdn mp4 URL in the HTML
  console.log('🎯 [VEO Parser] Method 2: Looking for veocdn mp4 URLs...');
  const veocdnRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.mp4/i;
  const veocdnMatch = html.match(veocdnRegex);
  
  if (veocdnMatch) {
    const videoUrl = veocdnMatch[0];
    console.log(`✅ [VEO Parser] Found veocdn video URL: ${videoUrl}`);
    
    // Look for veocdn poster URL (usually jpg)
    console.log('🎯 [VEO Parser] Looking for veocdn poster URL...');
    const posterRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.jpg/i;
    const posterMatch = html.match(posterRegex);
    const posterUrl = posterMatch ? posterMatch[0] : '';
    
    if (posterUrl) {
      console.log(`✅ [VEO Parser] Found veocdn poster URL: ${posterUrl}`);
    } else {
      console.log('⚠️ [VEO Parser] No veocdn poster URL found');
    }
    
    console.log('🎉 [VEO Parser] Method 2 SUCCESS - Returning video URL');
    return {
      videoUrl,
      posterUrl,
    };
  } else {
    console.log('❌ [VEO Parser] No veocdn mp4 URLs found');
    
    // Debug: Check for any veocdn URLs at all
    const anyVeocdnRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+/gi;
    const anyVeocdnMatches = html.match(anyVeocdnRegex);
    if (anyVeocdnMatches) {
      console.log(`🔍 [VEO Parser] DEBUG: Found ${anyVeocdnMatches.length} veocdn URLs (but no mp4):`);
      anyVeocdnMatches.slice(0, 5).forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    } else {
      console.log('🔍 [VEO Parser] DEBUG: No veocdn URLs found at all');
    }
    
    // Debug: Check for any mp4 URLs
    const anyMp4Regex = /https:\/\/[^"'\s]+\.mp4/gi;
    const anyMp4Matches = html.match(anyMp4Regex);
    if (anyMp4Matches) {
      console.log(`🔍 [VEO Parser] DEBUG: Found ${anyMp4Matches.length} mp4 URLs (but not veocdn):`);
      anyMp4Matches.slice(0, 3).forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    } else {
      console.log('🔍 [VEO Parser] DEBUG: No mp4 URLs found at all');
    }
  }

  console.log('❌ [VEO Parser] All HTML parsing methods failed');
  return {
    error: 'Could not find VEO video URL in page',
    details: 'No veocdn.com video URL found in the HTML content',
  };
}
