# System Patterns

## Architecture Patterns

### Component Organization
- **Page Components**: Top-level route components (e.g., `GamesPage`, `TeamDetailPage`)
- **Feature Components**: Business logic components (e.g., `GameAnalysis`, `CoachingPointsFlyout`)
- **UI Components**: Reusable interface elements (e.g., `Modal`, `ConfirmationDialog`)
- **Index Files**: Clean imports with `index.ts` re-exports

### Data Flow Patterns
- **Context Providers**: AuthContext for global authentication state
- **Custom Hooks**: Encapsulate complex logic (e.g., `useYouTubePlayer`, `useDrawingCanvas`)
- **API Layer**: Centralized API calls in `utils/api.ts`
- **Type Safety**: Shared type definitions between frontend/backend

### Authentication Pattern
```
Request → JWT Token → Supabase Auth → RLS Policies → Data Access
```
- JWT tokens passed in Authorization headers
- Row Level Security enforces data isolation
- Role-based access through team_memberships table

### Database Access Pattern
```
Frontend → Backend API → Supabase Client → PostgreSQL with RLS
```
- Frontend never directly accesses database
- Backend validates permissions before database operations
- RLS provides additional security layer

## UI/UX Patterns

### Modal System
- Generic `Modal` component for consistent behavior
- Specialized modals extend base modal (e.g., `CreateTeamModal`, `PlayerProfileModal`)
- Confirmation dialogs for destructive actions
- Focus management and keyboard navigation

### Form Patterns
- Controlled components with React state
- Validation before API submission
- Loading states during async operations
- Error handling with user feedback

### Navigation Patterns
- Role-based route protection
- Breadcrumb navigation where appropriate
- Consistent header/footer layout
- Mobile-responsive navigation

## Data Modeling Patterns

### Entity Relationships
- **Users** can be members of multiple **Teams** with different roles
- **Players** can exist without user accounts (for young children)
- **Guardians** have relationships with **Players** (not necessarily users)
- **Games** belong to teams and contain **Coaching Points**
- **Coaching Points** can be tagged to multiple players

### Event Sourcing for Recordings
- Coaching point recording sessions stored as event sequences
- Events include: play, pause, seek, draw, change_speed, recording_start
- Playback reconstructs exact coaching session experience
- JSONB event_data allows flexible event parameters

### Security Model
```
User → Team Membership → Role → Permissions → Data Access
```
- Row Level Security policies check user roles
- Guardians can only see their children's data
- Coaches can only manage their teams' content
- Cross-team data isolation enforced at database level

## Development Patterns

### Component Structure
```typescript
// Standard component pattern
interface ComponentProps {
  // Props typing
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Local state
  // Effects
  // Event handlers
  // Render JSX
}
```

### API Route Pattern
```typescript
// Backend route pattern
router.get('/api/resource', authenticateToken, async (req, res) => {
  try {
    // Validate permissions
    // Query database
    // Return response
  } catch (error) {
    // Error handling
  }
});
```

### Error Handling Strategy
- Backend: Try-catch blocks with structured error responses
- Frontend: Error boundaries for React component errors
- User feedback: Toast notifications or inline error messages
- Logging: Console logging for development, structured logging for production

### State Management Approach
- Global state: React Context for authentication
- Local state: Component state for UI interactions
- Server state: No caching layer, direct API calls
- Form state: Controlled components with local state

## Performance Patterns

### Loading Strategies
- Lazy loading for route-based code splitting
- Component-level loading states
- Optimistic updates where appropriate
- Debounced search/filter inputs

### Canvas Optimization
- RequestAnimationFrame for smooth drawing
- Event batching for performance
- Canvas clearing strategies
- Memory management for drawing data

### Video Integration
- YouTube Player API for efficient video control
- Custom event system for coaching point synchronization
- Minimal DOM manipulation during playback
- Efficient timestamp tracking

## Security Patterns

### Input Validation
- TypeScript interfaces for compile-time validation
- Runtime validation on API endpoints
- Sanitization of user input before database storage
- XSS prevention through React's built-in protections

### Authentication Flow
1. User login via Supabase Auth
2. JWT token stored in client
3. Token included in API requests
4. Backend validates token with Supabase
5. RLS policies enforce data access

### Authorization Patterns
- Role checking at API endpoint level
- Additional RLS policies at database level
- Guardian-specific data access patterns
- Team-based data isolation

## Testing Considerations
- Component testing with React Testing Library
- API endpoint testing with integration tests
- Database migration testing
- End-to-end testing for critical user flows
- Mock patterns for external services (YouTube API)
