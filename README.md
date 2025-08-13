# TACTIX - Team Video Coaching Platform

## Overview

TACTIX is a video-based coaching platform designed for youth sports teams. It allows coaches to upload game footage from YouTube and create interactive coaching sessions with time-synced feedback, drawings, and voice recordings. Players and guardians can access personalized coaching points specific to them.

## Project Structure

```
tactix/
├── frontend/          # React frontend application
├── backend/           # Express.js API server
├── supabase/          # Database migrations and configuration
├── scripts/           # Setup and deployment scripts
├── docs/              # Documentation
└── tasks/             # Development tasks and notes
```

## Key Features

- **Game Video Management** - Upload games via YouTube links, input scores, locations, and game types
- **Interactive Coaching Points** - Create feedback at specific timestamps with:
  - Voice recordings
  - On-screen drawings (arrows, shapes, plays)
  - Player tagging for personalized feedback
  - Labels for categorization (e.g., "defense", "corner kicks")
- **Team Management** - Organize coaches, players, and guardians with role-based access
- **Guardian Access** - Guardians can view coaching feedback specific to their children
- **Recording Sessions** - Coaches can record their entire coaching process, including video controls and drawing sequences, for players to replay later

## Technology Stack

- **Frontend**: React + TypeScript + Vite + Supabase Auth
- **Backend**: Node.js + Express + TypeScript + Supabase
- **Database**: PostgreSQL (via Supabase) with Row Level Security
- **Authentication**: Supabase Auth with JWT sessions
- **Storage**: Supabase Storage for audio recordings
- **Hosting**: 
  - Frontend: Vercel
  - Backend: Render
  - Database/Auth: Supabase

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase CLI (`npm install -g supabase`)

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd tactix
   npm run setup
   ```

2. **Configure environment variables:**
   - The setup script will prompt for your Supabase configuration
   - Or manually copy `.env.example` files and fill in your values

3. **Run database migrations:**
   ```bash
   cd supabase
   supabase db push
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

## Development

### Available Scripts

```bash
# Root level
npm run dev              # Start both frontend and backend
npm run build            # Build both applications
npm run setup            # Run initial project setup
npm run deploy           # Deploy to production

# Frontend specific
npm run dev:frontend     # Start frontend only
npm run build:frontend   # Build frontend

# Backend specific  
npm run dev:backend      # Start backend only
npm run build:backend    # Build backend
```

### Environment Variables

**Backend (.env):**
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Frontend (.env):**
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

## API Documentation

The backend API provides comprehensive endpoints for managing teams, games, and coaching analysis features with role-based access control.

For complete API documentation including all endpoints, authentication details, request/response formats, and examples, see: **[API Documentation](./docs/api-readme.md)**

### Quick Reference
- **Base URL**: `https://your-api-domain.com/api`
- **Authentication**: Bearer token (Supabase JWT) required for all endpoints
- **Modules**: Authentication, Teams, Games, Coaching Points, Events, Labels, and Player Tagging

## Database Schema

The application uses PostgreSQL with the following main tables:

- `user_profiles` - User profiles (integrated with Supabase Auth)
- `teams` - Team information
- `team_memberships` - User roles within teams
- `guardian_child_relationships` - guardian-child relationships
- `games` - Game records with YouTube video IDs
- `coaching_points` - Time-synced coaching feedback
- `coaching_point_events` - Recording session events
- `coaching_point_tagged_players` - Player tagging
- `labels` - Categorization labels
- `coaching_point_acknowledgments` - View tracking and acknowledgments

See [docs/schema.md](./docs/schema.md) for detailed schema documentation.

## Security

- Row Level Security (RLS) policies ensure data isolation
- JWT-based authentication via Supabase Auth
- Role-based access control through team memberships
- Guardians can only see their children's coaching points
- Coaches can only manage their own teams' content

## Deployment

### Production Setup

1. **Supabase:**
   - Create production project
   - Run migrations: `npx supabase db push --linked`
   - Configure auth settings and storage buckets

2. **Backend (Render):**
   - Connect GitHub repository
   - Use `backend/render.yaml` configuration
   - Set environment variables in dashboard

3. **Frontend (Vercel):**
   - Connect GitHub repository
   - Auto-deploys from main branch
   - Configure environment variables

4. **Run deployment script:**
   ```bash
   npm run deploy
   ```

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

For questions or issues:
1. Check the [documentation](./docs/)
2. Search existing [issues](../../issues)
3. Create a new issue with detailed information
