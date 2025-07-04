# TACTIX Project Setup

## Project Overview
TACTIX is a video-based coaching platform for youth sports teams that allows coaches to upload game footage from YouTube and create interactive coaching sessions with time-synced feedback, drawings, and voice recordings.

## Technology Stack (Cloud Deployment)
- **Backend**: Node.js + Express + Supabase (PostgreSQL, Auth, Storage, JWT Sessions)
- **Frontend**: React + Supabase JS SDK + jwt-decode
- **Hosting**: Supabase.com (DB/Auth), Render (Backend), Vercel (Frontend)

## Key Features to Support
1. YouTube video integration for game footage
2. Time-synced coaching points with drawings and voice recordings
3. Role-based access (coaches, players, parents, admins)
4. Parent-child relationships for viewing permissions
5. Team management and game tracking

## Database Requirements
The application needs the following tables (already designed):
- users, teams, team_memberships, parent_child_relationships
- games, coaching_points, coaching_point_events
- coaching_point_tagged_users, labels, coaching_point_labels
- coaching_point_views

**Important**: The `users` table needs to be integrated with Supabase Auth. Need to set up:
- Supabase Auth integration with the existing users table
- JWT session management
- Role-based access control linked to team_memberships

## Setup Tasks Needed

### 1. Project Structure
Create a monorepo structure with:
- `/backend` - Express API server
- `/frontend` - React application  
- `/supabase` - Database migrations and configuration
- `/scripts` - Deployment and setup scripts

### 2. Backend Setup
- Express server with TypeScript
- Supabase client configuration
- JWT verification middleware using Supabase Auth
- API routes for: auth, users, teams 
- CORS configuration for frontend
- Environment variables for Supabase keys
- Render deployment configuration (render.yaml)

### 3. Frontend Setup
- React app with TypeScript
- Supabase client for auth and direct DB access
- Protected routes based on auth state
- Components for login/create user, create team, view teams
- Environment variables for Supabase URL and anon key
- Vercel deployment configuration

### 4. Supabase Setup
- Migration file for all tables from schema.md
- Row Level Security (RLS) policies for:
  - Users can only see teams they're members of
  - Parents can see their children's coaching points
  - Only Coaches can create/edit coaching points for their teams
- Auth configuration to work with existing users table
- Storage buckets for audio recordings and drawing data

### 5. Deployment Scripts
- Script to initialize Supabase project and run migrations
- Script to set up environment variables
- Deployment script for Render (backend) and Vercel (frontend)
- README with setup instructions

## Specific Requirements

### Authentication Flow
1. User signs up/logs in via Supabase Auth
2. JWT is stored and used for API requests
3. Backend verifies JWT on protected routes
4. Frontend uses Supabase SDK for auth state management

### API Endpoints Needed
- POST /api/auth/login
- POST /api/auth/signup (creates user as a coach role)
- POST /api/auth/signup/:teamJoinCode (creates user & joins team as user role specified in joinCode)
- POST /api/auth/team (add team, creates join codes for players, parents, additional coaches)
- POST /api/auth/team/:teamId (update team)
- GET /api/teams (user's teams)

### Key Frontend Pages
1. Login/Signup
2. Team Dashboard (list of games)

## Development Priorities
1. Get basic auth working with Supabase
2. Set up database schema with proper RLS
3. Create minimal Express API
4. Build basic React app with auth
5. Deploy to cloud services

Please create the initial project structure with all necessary configuration files, basic implementations of auth flows, and deployment scripts to get started with development.