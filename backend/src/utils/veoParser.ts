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
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to wait for video-related elements to appear
    await Promise.race([
      page.waitForSelector('video', { timeout: 8000 }).catch(() => {}),
      page.waitForSelector('source', { timeout: 8000 }).catch(() => {}),
      page.waitForSelector('[src*="veocdn"]', { timeout: 8000 }).catch(() => {}),
      page.waitForSelector('[href*="veocdn"]', { timeout: 8000 }).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 8000))
    ]);
    
    // Additional wait for network activity to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to simulate user interaction that might trigger video loading
    try {
      // Click on any play buttons or video containers
      await page.evaluate(() => {
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
      });
      
      // Wait a bit after interaction
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (interactionError) {
      console.warn('User interaction simulation failed:', interactionError);
    }

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
          console.log('🎭 [VEO Parser] DOM Evaluation: Starting...');
          
          // Simple approach - just find the video element and its source
          const video = document.querySelector('video');
          console.log('🎭 [VEO Parser] DOM Evaluation: Video element found:', !!video);
          
          if (video) {
            console.log('🎭 [VEO Parser] DOM Evaluation: Video element details:');
            console.log('  - tagName:', video.tagName);
            console.log('  - poster:', video.poster || 'none');
            console.log('  - src:', video.src || 'none');
            console.log('  - children count:', video.children.length);
            
            const source = video.querySelector('source');
            console.log('🎭 [VEO Parser] DOM Evaluation: Source element found:', !!source);
            
            if (source) {
              console.log('🎭 [VEO Parser] DOM Evaluation: Source element details:');
              console.log('  - src:', source.src || 'none');
              console.log('  - type:', source.type || 'none');
              
              if (source.src) {
                console.log('🎉 [VEO Parser] DOM Evaluation: SUCCESS - Found video and poster');
                return {
                  videoUrl: source.src,
                  posterUrl: video.poster || '',
                };
              } else {
                console.log('❌ [VEO Parser] DOM Evaluation: Source element has no src');
              }
            } else {
              console.log('❌ [VEO Parser] DOM Evaluation: No source element in video');
              
              // Debug: List all children of video element
              console.log('🔍 [VEO Parser] DOM Evaluation: Video children:');
              for (let i = 0; i < video.children.length; i++) {
                const child = video.children[i];
                console.log(`  ${i + 1}. ${child.tagName} - ${child.outerHTML.substring(0, 100)}...`);
              }
            }
          } else {
            console.log('❌ [VEO Parser] DOM Evaluation: No video element found');
            
            // Debug: Check what elements are in the page
            const allElements = document.querySelectorAll('*');
            console.log(`🔍 [VEO Parser] DOM Evaluation: Total elements in page: ${allElements.length}`);
            
            // Look for elements that might contain video
            const videoRelated = document.querySelectorAll('[class*="video"], [id*="video"], [data-*="video"]');
            console.log(`🔍 [VEO Parser] DOM Evaluation: Video-related elements: ${videoRelated.length}`);
            if (videoRelated.length > 0) {
              console.log('🔍 [VEO Parser] DOM Evaluation: Video-related elements found:');
              Array.from(videoRelated).slice(0, 3).forEach((el, index) => {
                console.log(`  ${index + 1}. ${el.tagName}.${el.className} - ${el.outerHTML.substring(0, 100)}...`);
              });
            }
          }
          
          // Fallback: look for any veocdn URLs in the page
          console.log('🎭 [VEO Parser] DOM Evaluation: Fallback - searching HTML for veocdn URLs...');
          const bodyHTML = document.body?.innerHTML || '';
          console.log(`🎭 [VEO Parser] DOM Evaluation: Body HTML length: ${bodyHTML.length}`);
          
          const veocdnMatch = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.mp4/i);
          
          if (veocdnMatch) {
            const videoUrl = veocdnMatch[0];
            console.log(`✅ [VEO Parser] DOM Evaluation: Found veocdn URL in HTML: ${videoUrl}`);
            
            const posterMatch = bodyHTML.match(/https:\/\/[a-z]\.veocdn\.com\/[^"'\s]+\.jpg/i);
            const posterUrl = posterMatch ? posterMatch[0] : '';
            
            if (posterUrl) {
              console.log(`✅ [VEO Parser] DOM Evaluation: Found poster URL: ${posterUrl}`);
            } else {
              console.log('⚠️ [VEO Parser] DOM Evaluation: No poster URL found');
            }
            
            console.log('🎉 [VEO Parser] DOM Evaluation: SUCCESS via fallback');
            return {
              videoUrl,
              posterUrl,
            };
          } else {
            console.log('❌ [VEO Parser] DOM Evaluation: No veocdn URLs found in HTML');
            
            // Final debug: show a sample of the HTML
            const sampleHTML = bodyHTML.substring(0, 500);
            console.log('🔍 [VEO Parser] DOM Evaluation: HTML sample:', sampleHTML);
          }
          
          console.log('❌ [VEO Parser] DOM Evaluation: All methods failed');
          return null;
        });
      } catch (evalError) {
        console.warn('DOM evaluation failed:', evalError);
        videoData = null;
      }
    }

    if (videoData && videoData.videoUrl)
    {
      return videoData;
    }

    // Enhanced error reporting with debug info
    const debugInfo = videoData && typeof videoData === 'object' && !videoData.videoUrl ? videoData : {};
    
    return {
      error: 'Could not find video elements in the rendered VEO page',
      details: `Video content may require user interaction or authentication to load. Debug: ${JSON.stringify(debugInfo)}`,
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
    console.log('📡 [VEO Parser] Step 1: Fetching page HTML...');
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
    console.log(`📄 [VEO Parser] HTML received: ${html.length} characters`);

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