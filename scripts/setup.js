#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question)
{
  return new Promise((resolve) =>
  {
    rl.question(question, resolve);
  });
}

function execCommand(command, description)
{
  console.log(`📦 ${description}...`);
  try
  {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
    console.log(`✅ ${description} completed`);
  }
  catch (error)
  {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

async function setupProject()
{
  console.log('🚀 Setting up TACTIX project...\n');

  // 1. Install dependencies
  console.log('📦 Installing dependencies...');
  execCommand('npm install', 'Root dependencies installation');
  execCommand('cd frontend && npm install', 'Frontend dependencies installation');
  execCommand('cd backend && npm install', 'Backend dependencies installation');

  // 2. Check for Supabase CLI
  try
  {
    execSync('supabase --version', { stdio: 'pipe' });
    console.log('✅ Supabase CLI found');
  }
  catch
  {
    console.log('❌ Supabase CLI not found. Please install it:');
    console.log('npm install -g supabase');
    console.log('Or visit: https://supabase.com/docs/guides/cli');
    process.exit(1);
  }

  // 3. Get Supabase configuration
  console.log('\n🔧 Supabase Configuration');
  console.log('Please provide your Supabase project details:');

  const supabaseUrl = await prompt('Supabase Project URL: ');
  const supabaseAnonKey = await prompt('Supabase Anon Key: ');
  const supabaseServiceKey = await prompt('Supabase Service Role Key: ');

  // 4. Create environment files
  console.log('\n📝 Creating environment files...');

  // Backend .env
  const backendEnv = `# Backend Environment Variables
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}
`;

  fs.writeFileSync(path.join(rootDir, 'backend', '.env'), backendEnv);
  console.log('✅ Backend .env created');

  // Frontend .env
  const frontendEnv = `# Frontend Environment Variables
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}
VITE_API_URL=http://localhost:3001
`;

  fs.writeFileSync(path.join(rootDir, 'frontend', '.env'), frontendEnv);
  console.log('✅ Frontend .env created');

  // 5. Initialize Supabase project locally
  console.log('\n🗄️ Setting up Supabase...');
  try
  {
    execCommand('cd supabase && supabase init', 'Supabase initialization');
    console.log('✅ Supabase project initialized');
  }
  catch
  {
    console.log('⚠️ Supabase init failed or already initialized');
  }

  console.log('\n🎉 Project setup completed!');
  console.log('\nNext steps:');
  console.log('1. Run migrations: cd supabase && supabase db push');
  console.log('2. Start development: npm run dev');
  console.log('3. Open frontend: http://localhost:5173');
  console.log('4. Open backend: http://localhost:3001');

  rl.close();
}

setupProject().catch(console.error);
