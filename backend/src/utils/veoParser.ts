// VEO video URL parser utility
import puppeteer, { Browser, Page } from 'puppeteer';

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
 * Log memory usage for debugging production issues
 */
function logMemoryUsage(stage: string)
{
  const usage = process.memoryUsage();
  const formatMemory = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

  console.log(`🧠 [Memory ${stage}]`, {
    heapUsed: formatMemory(usage.heapUsed),
    heapTotal: formatMemory(usage.heapTotal),
    rss: formatMemory(usage.rss),
    external: formatMemory(usage.external),
  });
}

/**
 * Get or create a browser instance for Puppeteer with memory optimizations
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
    logMemoryUsage('before browser launch');

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
        // Memory optimization flags
        '--max-old-space-size=512',
        '--max-semi-space-size=8',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--no-default-browser-check',
        '--disable-site-isolation-trials',
        '--disable-features=site-per-process',
        '--memory-pressure-off',
        '--js-flags=--max-old-space-size=512',
        // Additional resource reduction (but keep JavaScript enabled)
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // VEO doesn't need images loaded for video URL extraction
        '--disable-plugins-discovery',
        '--disable-preconnect',
        '--disable-sync',
        '--disable-web-security',
      ],
    });

    // Handle browser disconnection
    browserInstance.on('disconnected', () =>
    {
      console.log('🔌 [VEO Parser] Browser disconnected');
      browserInstance = null;
    });

    logMemoryUsage('after browser launch');
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
  maxRetries = 3,
): Promise<T | null>
{
  for (let attempt = 0; attempt <= maxRetries; attempt++)
  {
    try
    {
      // Check if page is still valid
      if (page.isClosed())
      {
        console.warn(`Page is closed during ${operationName}, attempt ${attempt + 1}`);
        return null;
      }

      return await operation();
    }
    catch (error)
    {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (
        errorMessage.includes('detached Frame') ||
        errorMessage.includes('Target closed') ||
        errorMessage.includes('Session closed')
      )
      {
        console.warn(
          `${operationName} failed due to frame detachment, attempt ${attempt + 1}/${maxRetries + 1}: ${errorMessage}`,
        );

        if (attempt < maxRetries)
        {
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
 * Wait for video content using MutationObserver and network monitoring
 */
async function waitForVideoContent(page: Page, timeoutMs = 15000): Promise<boolean>
{
  console.log('🔍 [VEO Parser] Setting up dynamic video content detection...');

  return page.evaluate((timeout) =>
  {
    return new Promise<boolean>((resolve) =>
    {
      const startTime = Date.now();

      // Declare observer variable first, before cleanup function
      let observer: MutationObserver | null = null;

      const timer = setTimeout(() =>
      {
        console.log('⏰ [VEO Parser] Video content detection timeout reached');
        cleanup();
        resolve(false);
      }, timeout);

      const cleanup = () =>
      {
        clearTimeout(timer);
        if (observer) observer.disconnect();
      };

      // Check if video content already exists
      const checkVideoContent = () =>
      {
        // Method 1: Check for video element with veocdn source
        const video = document.querySelector('video');
        if (video)
        {
          const source = video.querySelector('source');
          if (source?.src?.includes('veocdn') && source.src.includes('.mp4'))
          {
            console.log('✅ [VEO Parser] Found video element with veocdn source');
            cleanup();
            resolve(true);
            return true;
          }
        }

        // Method 2: Check for veocdn URLs in page content
        const pageContent = document.body.innerHTML;
        const veocdnMatch = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.mp4/i.test(pageContent);
        if (veocdnMatch)
        {
          console.log('✅ [VEO Parser] Found veocdn URL in page content');
          cleanup();
          resolve(true);
          return true;
        }

        return false;
      };

      // Initial check
      if (checkVideoContent()) return;

      // Set up MutationObserver to watch for DOM changes

      try
      {
        observer = new MutationObserver((mutations) =>
        {
          // Throttle checks to avoid excessive processing
          const now = Date.now();
          if (now - startTime > timeout)
          {
            cleanup();
            resolve(false);
            return;
          }

          // Check if any mutations involve video-related elements
          const hasVideoMutation = mutations.some(mutation =>
          {
            if (mutation.type === 'childList')
            {
              return Array.from(mutation.addedNodes).some(node =>
              {
                if (node.nodeType === Node.ELEMENT_NODE)
                {
                  const element = node as Element;
                  return element.tagName === 'VIDEO' ||
                    element.tagName === 'SOURCE' ||
                    element.querySelector?.('video, source') ||
                    element.innerHTML?.includes('veocdn');
                }
                return false;
              });
            }
            return false;
          });

          if (hasVideoMutation)
          {
            console.log('🔄 [VEO Parser] Video-related DOM change detected, checking content...');
            checkVideoContent();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false, // Don't watch attributes to reduce noise
          characterData: false, // Don't watch text changes
        });

        console.log('👀 [VEO Parser] MutationObserver active, watching for video content...');
      }
      catch (error)
      {
        console.warn('⚠️ [VEO Parser] Could not set up MutationObserver:', error);
        // Fallback to polling if MutationObserver fails
        const pollInterval = setInterval(() =>
        {
          if (checkVideoContent() || Date.now() - startTime > timeout)
          {
            clearInterval(pollInterval);
            cleanup();
            resolve(checkVideoContent());
          }
        }, 500);
      }
    });
  }, timeoutMs);
}

/**
 * Wait for video response from network
 */
async function waitForVideoResponse(page: Page, timeoutMs = 10000): Promise<string | null>
{
  return new Promise((resolve) =>
  {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    let resolved = false;

    const responseHandler = async (response: any) =>
    {
      if (resolved) return;

      const url = response.url();
      if (url.includes('veocdn.com') && url.endsWith('.mp4'))
      {
        console.log(`🎯 [VEO Parser] Detected video response: ${url.substring(0, 80)}...`);
        resolved = true;
        clearTimeout(timer);
        page.off('response', responseHandler);
        resolve(url);
      }
    };

    page.on('response', responseHandler);

    // Cleanup if timeout
    setTimeout(() =>
    {
      if (!resolved)
      {
        page.off('response', responseHandler);
      }
    }, timeoutMs);
  });
}

/**
 * Smart interaction that waits for actual content changes
 */
async function performSmartInteraction(page: Page): Promise<boolean>
{
  console.log('🎯 [VEO Parser] Performing smart user interaction...');

  return page.evaluate((): Promise<boolean> =>
  {
    return new Promise<boolean>(function(resolve)
    {
      var timeout = setTimeout(function()
      {
        resolve(false);
      }, 5000);

      // Get initial page state
      var initialContentLength = document.body.innerHTML.length;
      var initialVideoCount = document.querySelectorAll('video').length;

      // Look for and click play buttons
      var playSelectors = [
        'button[aria-label*="play"]',
        'button[title*="play"]',
        '.play-button',
        '.video-play',
        '[data-testid*="play"]',
        'button:has(svg)',
        '.video-container button',
      ];

      var clicked = false;
      for (var i = 0; i < playSelectors.length; i++)
      {
        var selector = playSelectors[i];
        var elements = document.querySelectorAll(selector);
        for (var j = 0; j < elements.length; j++)
        {
          try
          {
            (elements[j] as HTMLElement).click();
            clicked = true;
            console.log('🎯 [VEO Parser] Clicked play button: ' + selector);
            break;
          }
          catch (error)
          {
            console.warn('⚠️ [VEO Parser] Failed to click ' + selector + ':', error);
          }
        }
        if (clicked) break;
      }

      // If no play button found, try clicking video elements
      if (!clicked)
      {
        var videos = document.querySelectorAll('video, .video-player, [class*="video"]');
        for (var k = 0; k < videos.length; k++)
        {
          try
          {
            (videos[k] as HTMLElement).click();
            clicked = true;
            console.log('🎯 [VEO Parser] Clicked video element');
            break;
          }
          catch (error)
          {
            console.warn('⚠️ [VEO Parser] Failed to click video element:', error);
          }
        }
      }

      if (!clicked)
      {
        console.log('ℹ️ [VEO Parser] No interactive elements found to click');
        clearTimeout(timeout);
        resolve(false);
        return;
      }

      // Watch for changes after interaction
      var checkForChanges = function()
      {
        var newContentLength = document.body.innerHTML.length;
        var newVideoCount = document.querySelectorAll('video').length;

        if (newContentLength !== initialContentLength || newVideoCount !== initialVideoCount)
        {
          console.log('✅ [VEO Parser] Content changed after interaction');
          clearTimeout(timeout);
          resolve(true);
        }
      };

      // Check immediately and then periodically
      setTimeout(checkForChanges, 100);
      setTimeout(checkForChanges, 500);
      setTimeout(checkForChanges, 1000);
      setTimeout(checkForChanges, 2000);
    });
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
    logMemoryUsage('before Puppeteer launch');

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
        // Memory optimization flags
        '--max-old-space-size=512',
        '--max-semi-space-size=8',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--no-default-browser-check',
        '--disable-site-isolation-trials',
        '--disable-features=site-per-process',
        '--memory-pressure-off',
        '--js-flags=--max-old-space-size=512',
        '--disable-images', // VEO doesn't need images loaded for video URL extraction
        '--disable-plugins',
        '--disable-plugins-discovery',
        '--disable-preconnect',
        '--disable-sync',
      ],
    });

    logMemoryUsage('after Puppeteer launch');

    page = await browser.newPage();

    logMemoryUsage('after new page');

    // Enable request interception to block heavy resources while preserving URL extraction
    await page.setRequestInterception(true);
    page.on('request', (request) =>
    {
      const url = request.url();
      const resourceType = request.resourceType();

      // Block heavy resources to save memory and bandwidth
      if (
        resourceType === 'media' ||
        resourceType === 'font' ||
        resourceType === 'image' ||
        (resourceType === 'other' &&
          (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') || url.includes('.avi')))
      )
      {
        console.log(`🚫 [VEO Parser] Blocking ${resourceType}: ${url.substring(0, 80)}...`);
        request.abort();
      }
      // Allow veocdn URLs that might contain video metadata but block actual video files
      else if (url.includes('veocdn.com') && (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov')))
      {
        console.log(`🚫 [VEO Parser] Blocking veocdn video: ${url.substring(0, 80)}...`);
        request.abort();
      }
      // Block analytics and tracking to reduce noise
      else if (
        resourceType === 'other' &&
        (url.includes('analytics') || url.includes('tracking') || url.includes('gtm') || url.includes('facebook') ||
          url.includes('google-analytics'))
      )
      {
        console.log(`🚫 [VEO Parser] Blocking tracking: ${url.substring(0, 60)}...`);
        request.abort();
      }
      else
      {
        request.continue();
      }
    });

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

    // Ensure page is stable before proceeding
    console.log('⏳ [VEO Parser] Waiting for page to stabilize...');
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });

    // Additional stability check - wait for body to be available
    await page.waitForSelector('body', { timeout: 5000 });

    // Start multiple detection strategies in parallel
    console.log('🔍 [VEO Parser] Starting dynamic content detection...');
    const detectionPromises = [
      waitForVideoContent(page, 15000),
      waitForVideoResponse(page, 12000),
    ];

    // Race the detection methods
    const detectionResults = await Promise.allSettled(detectionPromises);
    const videoContentFound = detectionResults[0].status === 'fulfilled' && detectionResults[0].value;
    const videoResponseFound = detectionResults[1].status === 'fulfilled' && detectionResults[1].value;

    if (videoContentFound)
    {
      console.log('✅ [VEO Parser] Video content detected via DOM monitoring');
    }
    else if (videoResponseFound)
    {
      console.log(`✅ [VEO Parser] Video response detected: ${videoResponseFound}`);
    }
    else
    {
      console.log('⚠️ [VEO Parser] No video content detected, attempting user interaction...');
    }

    // Try multiple approaches to find video data with safe operations
    let videoData = null;

    // Approach 1: Try to get page content first (safest)
    console.log('📄 [VEO Parser] Attempting to get page content...');
    const content = await safePageOperation(
      page,
      () => page!.content(),
      'getting page content',
    );

    if (content)
    {
      const regexResult = parseVideoFromHtml(content);
      if (!('error' in regexResult))
      {
        console.log('✅ [VEO Parser] Successfully parsed video from HTML content');
        videoData = regexResult;
      }
    }

    // Approach 2: If regex parsing didn't work, try DOM evaluation with safe operation
    if (!videoData)
    {
      console.log('🎭 [VEO Parser] Attempting DOM evaluation...');
      videoData = await safePageOperation(
        page,
        () =>
          page!.evaluate(() =>
          {
            console.log('🎭 [VEO Parser] DOM Evaluation: Starting...');

            // Simple approach - just find the video element and its source
            const video = document.querySelector('video');
            console.log('🎭 [VEO Parser] DOM Evaluation: Video element found:', !!video);

            if (video)
            {
              const source = video.querySelector('source');
              console.log('🎭 [VEO Parser] DOM Evaluation: Source element found:', !!source);

              if (source && source.src)
              {
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

            if (veocdnMatch)
            {
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
        'DOM evaluation',
      );
    }

    if (videoData && videoData.videoUrl)
    {
      console.log('🎉 [VEO Parser] Successfully extracted video data');
      logMemoryUsage('before cleanup');
      return videoData;
    }

    console.log('❌ [VEO Parser] Could not find video elements');
    logMemoryUsage('before cleanup');
    return {
      error: 'Could not find video elements in the rendered VEO page',
      details: 'Video content may require user interaction or authentication to load',
    };
  }
  catch (error)
  {
    console.error('Puppeteer parsing error:', error);

    // Check if this is a detached frame error and we can retry
    if (
      error instanceof Error &&
      (error.message.includes('detached Frame') ||
        error.message.includes('Target closed') ||
        error.message.includes('Session closed')) &&
      retryCount < maxRetries
    )
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
    if (page)
    {
      try
      {
        if (!page.isClosed())
        {
          await page.close();
        }
      }
      catch (closeError)
      {
        // Ignore close errors as they often happen with detached frames
        const errorMsg = closeError instanceof Error ? closeError.message : 'Unknown error';
        console.warn('Page close warning (can be ignored):', errorMsg);
      }
    }

    // Always close the browser since we create a fresh one each time
    if (browser)
    {
      try
      {
        if (browser.isConnected())
        {
          await browser.close();
        }
      }
      catch (browserCloseError)
      {
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

    if (!('error' in puppeteerResult))
    {
      console.log('🎉 [VEO Parser] SUCCESS with Puppeteer parsing!');
      console.log(`📹 [VEO Parser] Video URL: ${puppeteerResult.videoUrl}`);
      console.log(`🖼️ [VEO Parser] Poster URL: ${puppeteerResult.posterUrl}`);
    }
    else
    {
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

  if (videoMatch)
  {
    const posterUrl = videoMatch[1];
    console.log(`✅ [VEO Parser] Found video element with poster: ${posterUrl}`);

    // Now find the source element within the video
    console.log('🎯 [VEO Parser] Looking for source element...');
    const sourceRegex = /<source[^>]*src=["']([^"']+\.mp4[^"']*)["'][^>]*type=["']video\/mp4["'][^>]*>/i;
    const sourceMatch = html.match(sourceRegex);

    if (sourceMatch)
    {
      const videoUrl = sourceMatch[1];
      console.log(`✅ [VEO Parser] Found source element with video URL: ${videoUrl}`);
      console.log('🎉 [VEO Parser] Method 1 SUCCESS - Returning video and poster URLs');
      return {
        videoUrl,
        posterUrl,
      };
    }
    else
    {
      console.log('❌ [VEO Parser] No source element found with Method 1');
      // Try a more flexible source regex
      const flexibleSourceRegex = /<source[^>]*src=["']([^"']+\.mp4[^"']*)["'][^>]*>/i;
      const flexibleSourceMatch = html.match(flexibleSourceRegex);
      if (flexibleSourceMatch)
      {
        const videoUrl = flexibleSourceMatch[1];
        console.log(`✅ [VEO Parser] Found source element with flexible regex: ${videoUrl}`);
        return {
          videoUrl,
          posterUrl,
        };
      }
    }
  }
  else
  {
    console.log('❌ [VEO Parser] No video element with poster found');

    // Debug: Check if there's any video element at all
    const anyVideoRegex = /<video[^>]*>/i;
    const anyVideoMatch = html.match(anyVideoRegex);
    if (anyVideoMatch)
    {
      console.log(`🔍 [VEO Parser] DEBUG: Found video element without poster: ${anyVideoMatch[0]}`);
    }
    else
    {
      console.log('🔍 [VEO Parser] DEBUG: No video element found at all');
    }
  }

  // Method 2: Even simpler - just look for any veocdn mp4 URL in the HTML
  console.log('🎯 [VEO Parser] Method 2: Looking for veocdn mp4 URLs...');
  const veocdnRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.mp4/i;
  const veocdnMatch = html.match(veocdnRegex);

  if (veocdnMatch)
  {
    const videoUrl = veocdnMatch[0];
    console.log(`✅ [VEO Parser] Found veocdn video URL: ${videoUrl}`);

    // Look for veocdn poster URL (usually jpg)
    console.log('🎯 [VEO Parser] Looking for veocdn poster URL...');
    const posterRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.jpg/i;
    const posterMatch = html.match(posterRegex);
    const posterUrl = posterMatch ? posterMatch[0] : '';

    if (posterUrl)
    {
      console.log(`✅ [VEO Parser] Found veocdn poster URL: ${posterUrl}`);
    }
    else
    {
      console.log('⚠️ [VEO Parser] No veocdn poster URL found');
    }

    console.log('🎉 [VEO Parser] Method 2 SUCCESS - Returning video URL');
    return {
      videoUrl,
      posterUrl,
    };
  }
  else
  {
    console.log('❌ [VEO Parser] No veocdn mp4 URLs found');

    // Debug: Check for any veocdn URLs at all
    const anyVeocdnRegex = /https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+/gi;
    const anyVeocdnMatches = html.match(anyVeocdnRegex);
    if (anyVeocdnMatches)
    {
      console.log(`🔍 [VEO Parser] DEBUG: Found ${anyVeocdnMatches.length} veocdn URLs (but no mp4):`);
      anyVeocdnMatches.slice(0, 5).forEach((url, index) =>
      {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
    else
    {
      console.log('🔍 [VEO Parser] DEBUG: No veocdn URLs found at all');
    }

    // Debug: Check for any mp4 URLs
    const anyMp4Regex = /https:\/\/[^"'\s]+\.mp4/gi;
    const anyMp4Matches = html.match(anyMp4Regex);
    if (anyMp4Matches)
    {
      console.log(`🔍 [VEO Parser] DEBUG: Found ${anyMp4Matches.length} mp4 URLs (but not veocdn):`);
      anyMp4Matches.slice(0, 3).forEach((url, index) =>
      {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
    else
    {
      console.log('🔍 [VEO Parser] DEBUG: No mp4 URLs found at all');
    }
  }

  console.log('❌ [VEO Parser] All HTML parsing methods failed');
  return {
    error: 'Could not find VEO video URL in page',
    details: 'No veocdn.com video URL found in the HTML content',
  };
}
