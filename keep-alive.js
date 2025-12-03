#!/usr/bin/env node

/**
 * TACTIX Keep-Alive Script
 * 
 * This script keeps your Render backend and Supabase database active on free tiers
 * by periodically sending health check requests.
 * 
 * Usage:
 *   node keep-alive.js [options]
 * 
 * Options:
 *   --backend-url <url>    Backend URL (default: https://tactix-hls7.onrender.com)
 *   --interval <seconds>   Interval between requests in seconds (default: 300, min: 60)
 *   --check-db             Also query the database to keep Supabase active (default: true)
 *   --verbose              Enable verbose logging
 *   --once                 Run once and exit (useful for cron jobs)
 */

import https from 'https';
import http from 'http';

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  backendUrl: 'https://tactix-hls7.onrender.com',
  interval: 300, // 5 minutes
  checkDb: true,
  verbose: false,
  once: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--backend-url':
      config.backendUrl = args[++i];
      break;
    case '--interval':
      config.interval = Math.max(60, parseInt(args[++i], 10));
      break;
    case '--check-db':
      config.checkDb = args[++i]?.toLowerCase() !== 'false';
      break;
    case '--verbose':
      config.verbose = true;
      break;
    case '--once':
      config.once = true;
      break;
    case '--help':
    case '-h':
      console.log(`
TACTIX Keep-Alive Script

Usage:
  node keep-alive.js [options]

Options:
  --backend-url <url>    Backend URL (default: https://tactix-hls7.onrender.com)
  --interval <seconds>   Interval between requests in seconds (default: 300, min: 60)
  --check-db             Also query the database to keep Supabase active (default: true)
  --verbose              Enable verbose logging
  --once                 Run once and exit (useful for cron jobs)
  --help, -h             Show this help message

Examples:
  # Run continuously with default settings
  node keep-alive.js

  # Run with custom interval and verbose output
  node keep-alive.js --interval 180 --verbose

  # Run once (for cron job)
  node keep-alive.js --once

  # Custom backend URL
  node keep-alive.js --backend-url https://my-backend.com
      `);
      process.exit(0);
  }
}

// Normalize URL
config.backendUrl = config.backendUrl.replace(/\/$/, ''); // Remove trailing slash

/**
 * Make an HTTP(S) request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve({ success: true, data: json, statusCode: res.statusCode, duration });
          } catch (e) {
            resolve({ success: true, data: data, statusCode: res.statusCode, duration });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Ping the backend health endpoint
 */
async function pingBackend() {
  const url = `${config.backendUrl}/health${config.checkDb ? '?db=true' : ''}`;
  
  try {
    const result = await makeRequest(url);
    const dbStatus = result.data.database ? ` | DB: ${result.data.database.status}` : '';
    
    console.log(`✅ [${new Date().toISOString()}] Backend OK (${result.duration}ms)${dbStatus}`);
    
    if (config.verbose && result.data) {
      console.log(`   Response:`, JSON.stringify(result.data, null, 2));
    }
    
    return true;
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Backend ping failed:`, error.message);
    return false;
  }
}

/**
 * Main execution loop
 */
async function run() {
  console.log('🚀 TACTIX Keep-Alive Script Starting...');
  console.log(`   Backend URL: ${config.backendUrl}`);
  console.log(`   Database Check: ${config.checkDb ? 'enabled' : 'disabled'}`);
  
  if (!config.once) {
    console.log(`   Interval: ${config.interval} seconds (${Math.round(config.interval / 60)} minutes)`);
    console.log('   Press Ctrl+C to stop\n');
  } else {
    console.log('   Mode: Single run\n');
  }
  
  // Initial ping
  await pingBackend();
  
  if (config.once) {
    console.log('\n✨ Single run completed');
    process.exit(0);
  }
  
  // Schedule next ping with random interval
  const scheduleNextPing = () => {
    // Random delay between 10 seconds and the configured interval
    const minDelay = 10 * 1000;
    const maxDelay = config.interval * 1000;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    
    const nextRun = new Date(Date.now() + delay);
    if (config.verbose) {
      console.log(`Next ping in ${Math.round(delay / 1000)} seconds (at ${nextRun.toLocaleTimeString()})...`);
    } else {
      console.log(`Next ping at ${nextRun.toLocaleTimeString()}`);
    }
    
    setTimeout(async () => {
      await pingBackend();
      scheduleNextPing();
    }, delay);
  };

  scheduleNextPing();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down...');
  process.exit(0);
});

// Start the script
run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
