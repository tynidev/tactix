# TACTIX Deployment Guide

## ✅ Frontend Deployed to Vercel
- **URL**: https://tactix-frontend-4pv6kwwys-tynidevs-projects.vercel.app
- **Status**: ✅ Deployed successfully

### Required Environment Variables for Frontend
Add these in Vercel Dashboard: https://vercel.com/tynidevs-projects/tactix-frontend/settings/environment-variables

1. `VITE_SUPABASE_URL` - Your Supabase project URL
2. `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
3. `VITE_API_URL` - Backend URL (will be available after backend deployment)

## 🔄 Backend Deployment to Render

### Step 1: Create Render Account
1. Go to https://render.com and sign up/login
2. Connect your GitHub account

### Step 2: Deploy Backend
1. In Render dashboard, click "New +"
2. Select "Web Service"
3. Connect your GitHub repository: `tynidev/tactix`
4. Use these settings:
   - **Name**: `tactix-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `master`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 3: Set Environment Variables in Render
Add these environment variables in Render dashboard:

1. `NODE_ENV` = `production`
2. `SUPABASE_URL` = Your Supabase project URL
3. `SUPABASE_ANON_KEY` = Your Supabase anonymous key
4. `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase service role key
5. `FRONTEND_URL` = `https://tactix-frontend-4pv6kwwys-tynidevs-projects.vercel.app`

### Step 4: Update Frontend with Backend URL
After backend deployment, update the frontend environment variable:
1. Go to Vercel dashboard
2. Add `VITE_API_URL` with your Render backend URL
3. Redeploy frontend

## 🗄️ Supabase Setup

### Step 1: Create Production Database
1. Create a new Supabase project at https://supabase.com
2. Save your:
   - Project URL
   - Anon key
   - Service role key

### Step 2: Run Migrations
```bash
cd supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### Step 3: Configure Auth
1. In Supabase dashboard, go to Authentication → URL Configuration
2. Add your frontend URL as allowed redirect URL
3. Set site URL to your frontend URL

## 🚀 Final Steps

1. Deploy backend to Render with environment variables
2. Update frontend `VITE_API_URL` in Vercel
3. Test the complete flow:
   - Sign up new user
   - Create team
   - Verify authentication works

## 📝 Important Notes

- Both services use the FREE tier initially
- Render may sleep after inactivity (first request might be slow)
- Vercel has excellent uptime for frontend hosting
- All environment variables contain sensitive data - keep them secure

## 🔧 Troubleshooting

### Backend Issues
- Check Render logs for deployment errors
- Verify all environment variables are set
- Ensure Supabase credentials are correct

### Frontend Issues
- Check browser console for errors
- Verify CORS is properly configured
- Test API endpoints directly

### Database Issues
- Verify migrations ran successfully
- Check RLS policies are active
- Test database connections
