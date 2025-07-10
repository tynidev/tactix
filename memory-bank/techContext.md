# Technical Context

## Architecture Overview
Full-stack web application using modern JavaScript ecosystem with cloud-hosted services for scalability and minimal maintenance overhead.

## Technology Stack

### Frontend
- **React 18+**: Component-based UI library
- **TypeScript**: Type safety and developer experience
- **Vite**: Fast build tool and development server
- **CSS**: Custom styling with component-scoped CSS files
- **Supabase JS SDK**: Database queries and authentication

### Backend
- **Node.js 18+**: JavaScript runtime
- **Express.js**: Web framework for API endpoints
- **TypeScript**: Consistent typing across stack
- **Supabase Client**: Database operations and auth verification

### Database & Services
- **PostgreSQL**: Primary database via Supabase
- **Supabase Auth**: JWT-based authentication system
- **Supabase Storage**: Audio file storage for voice recordings
- **Row Level Security (RLS)**: Data isolation and security
- **YouTube API**: Video embedding and playback

### Development Tools
- **dprint**: Code formatting
- **concurrently**: Run multiple npm scripts simultaneously
- **Git**: Version control
- **npm workspaces**: Monorepo management

### Hosting & Deployment
- **Vercel**: Frontend hosting with global CDN
- **Render**: Backend API hosting with auto-sleep
- **Supabase Cloud**: Database, auth, and storage hosting

## Key Technical Decisions

### Authentication Strategy
- Supabase Auth for user management and JWT sessions
- Row Level Security policies for data access control
- Role-based access through team memberships table
- Guardian-child relationships for family access patterns

### Video Integration
- YouTube embedding eliminates video hosting costs
- YouTube Player API for programmatic control
- Custom timestamp tracking for coaching points
- Drawing overlay system independent of video player

### Data Architecture
- Normalized relational design for complex relationships
- Event-based recording system for playback functionality
- JSONB fields for flexible event data storage
- Foreign key constraints maintaining referential integrity

### State Management
- React Context for authentication state
- Component-level state for UI interactions
- Custom hooks for complex business logic
- No external state management library (keeping it simple)

### Security Considerations
- JWT tokens for API authentication
- RLS policies enforce data isolation
- Environment variables for sensitive configuration
- CORS policies for cross-origin requests
- Input validation on both client and server

## Development Environment

### Project Structure
```
tactix/
├── frontend/          # React application
├── backend/           # Express API server
├── supabase/          # Database migrations
├── docs/              # Project documentation
├── tasks/             # Development tracking
└── memory-bank/       # Cline's memory system
```

### Environment Variables
**Backend**: PORT, NODE_ENV, FRONTEND_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
**Frontend**: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

### Development Workflow
- `npm run dev`: Start both frontend (port 5173) and backend (port 3001)
- `npm run build`: Build both applications for production
- `npm run fmt`: Format code using dprint
- Database migrations via Supabase CLI `npx supabase`

## Performance Considerations
- Vite for fast development builds and hot module replacement
- Component code splitting for optimized loading
- Lazy loading of non-critical components
- Efficient YouTube Player API usage
- Optimized drawing canvas rendering

## Browser Compatibility
- Modern browsers supporting ES2020+ features
- Canvas API for drawing functionality
- Web Audio API for voice recordings
- Responsive design for mobile devices

## Monitoring & Debugging
- Console logging for development
- Error boundaries for React error handling
- Supabase dashboard for database monitoring
- Vercel analytics for frontend performance
- Render logs for backend monitoring

## Future Technical Considerations
- Progressive Web App (PWA) capabilities
- Offline functionality for coaching point review
- Real-time collaboration features
- Mobile app development (React Native)
- Advanced video analysis features
