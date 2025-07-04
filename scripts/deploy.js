#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

function execCommand(command, description)
{
  console.log(`🚀 ${description}...`);
  try
  {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
    console.log(`✅ ${description} completed`);
  }
  catch (error)
  {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function deploy()
{
  console.log('🚀 Deploying TACTIX to production...\n');

  // 1. Build frontend
  execCommand('cd frontend && npm run build', 'Building frontend');

  // 2. Build backend
  execCommand('cd backend && npm run build', 'Building backend');

  // 3. Deploy to Vercel (frontend)
  console.log('\n📱 Deploying frontend to Vercel...');
  console.log('Make sure you have configured environment variables in Vercel:');
  console.log('- VITE_SUPABASE_URL');
  console.log('- VITE_SUPABASE_ANON_KEY');
  console.log('- VITE_API_URL (your Render backend URL)');

  try
  {
    execCommand('cd frontend && vercel --prod', 'Frontend deployment to Vercel');
  }
  catch
  {
    console.log('⚠️ Vercel deployment failed. Make sure Vercel CLI is installed:');
    console.log('npm install -g vercel');
    console.log('Then run: vercel login and try again');
  }

  // 4. Instructions for Render deployment
  console.log('\n🖥️ Backend deployment to Render:');
  console.log('1. Connect your GitHub repository to Render');
  console.log('2. Use the render.yaml configuration in the backend folder');
  console.log('3. Set environment variables in Render dashboard:');
  console.log('   - NODE_ENV=production');
  console.log('   - SUPABASE_URL');
  console.log('   - SUPABASE_ANON_KEY');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('   - FRONTEND_URL (your Vercel URL)');

  // 5. Supabase production setup
  console.log('\n🗄️ Supabase production setup:');
  console.log('1. Run migrations: supabase db push --linked');
  console.log('2. Update auth configuration with your production URLs');
  console.log('3. Set up storage buckets for audio files');

  console.log('\n🎉 Deployment guide completed!');
  console.log('Make sure to update your environment variables in both platforms.');
}

deploy().catch(console.error);
