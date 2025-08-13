# TACTIX Feature Requests - Feasibility Analysis & Implementation Plan

## Overview

This document provides a comprehensive analysis of the Coach's Ideal TACTIX Features, evaluating feasibility based on the current system architecture and providing detailed implementation plans for each feature.

## Current System Foundation

The TACTIX platform already has a robust foundation that supports many of the requested features:

### Existing Database Schema
- **`coaching_point_acknowledgments`** - Already tracks viewing with `acknowledged` and `ack_at` fields
- **`guardian_player_relationships`** - Links guardians to their children
- **`coaching_point_tagged_players`** - Associates players with specific coaching points
- **`labels` & `coaching_point_labels`** - Categorization system for coaching points
- **Role-based access control** - Coach, player, admin, guardian roles implemented

### Current Technology Stack
- **Frontend:** React + TypeScript with comprehensive coaching point management
- **Backend:** Express.js with full CRUD API for coaching points
- **Database:** PostgreSQL via Supabase with Row Level Security (RLS)
- **Authentication:** Supabase Auth with JWT sessions
- **Real-time capabilities:** Supabase subscriptions available

---

## Feature Analysis

### 1. Player Acknowledgement & Notes ✅ **HIGHLY FEASIBLE**

**Description:** Players watch a clip → check a box to confirm they watched it. Field to add a note on what they learned → sent to the coach.

#### Current Foundation
- `coaching_point_acknowledgments` table already exists with:
  - `acknowledged` (boolean) field
  - `ack_at` (timestamp) field

#### Implementation Plan

**Database Changes:**
```sql
-- Add notes field to existing coaching_point_acknowledgments table
ALTER TABLE coaching_point_acknowledgments 
ADD COLUMN notes TEXT;
```

**Backend API Endpoints:**
```typescript
// New/Enhanced endpoints needed
POST   /api/coaching-point-views              // Mark as viewed/acknowledged with notes
PUT    /api/coaching-point-views/:id          // Update acknowledgment/notes
GET    /api/coaching-point-views/player/:playerId  // Get player's view history
GET    /api/coaching-point-views/coach/:coachId    // Get coach's players' acknowledgments
```

**Frontend Changes:**
- Add acknowledgment checkbox to coaching point viewer
- Add notes textarea below video player
- Auto-save functionality for notes
- Coach dashboard showing player acknowledgments

**Implementation Steps:**
1. Database migration to add `notes` field
2. Extend existing coaching point API endpoints
3. Update GameAnalysis component with acknowledgment UI
4. Create coach report view for tracking acknowledgments

**Effort Estimate:** Low (1-2 weeks) - leverages existing infrastructure

---

### 2. Guardian/Family Following ✅ **HIGHLY FEASIBLE**

**Description:** Parents & grandparents can "follow" their player. View all clips tagged with that player's name in a compilation.

#### Current Foundation
- `guardian_player_relationships` table links guardians to players
- `coaching_point_tagged_players` associates players with coaching points
- Role-based access control already includes guardian role

#### Implementation Plan

**Database Changes:**
```sql
-- No schema changes needed - relationships already exist
-- May want to add notification preferences
CREATE TABLE guardian_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID REFERENCES user_profiles(id),
  player_id UUID REFERENCES player_profiles(id),
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Backend API Endpoints:**
```typescript
// New endpoints needed
GET    /api/coaching-points/guardian/:guardianId           // All clips for guardian's children
GET    /api/coaching-points/player/:playerId/guardian-view // Specific player's clips for guardian
GET    /api/guardian/children                              // Get guardian's children
PUT    /api/guardian/preferences                           // Update notification preferences
```

**Frontend Changes:**
- New guardian dashboard page
- Player compilation view showing all their coaching points
- Filter by child (for guardians with multiple children)
- Timeline view of player progress

**Implementation Steps:**
1. Create guardian-specific API endpoints
2. Build guardian dashboard component
3. Implement player compilation view
4. Add guardian navigation and routing

**Effort Estimate:** Medium (2-3 weeks) - new dashboard but leverages existing data

---

### 3. Automatic Highlight Reels ✅ **HIGHLY FEASIBLE**

**Description:** Coach tags a clip as a "highlight." System automatically compiles highlights into a reel and provides a highlight segments player.

#### Current Foundation
- Labels system exists for categorization
- Video player and coaching point system in place
- Existing YouTube player hook (`useYouTubePlayer.ts`) with seeking/playback control

#### Enhanced Implementation Plan

**Database Changes:**
```sql
-- Add highlight flag to coaching points
ALTER TABLE coaching_points 
ADD COLUMN is_highlight BOOLEAN DEFAULT false;

-- Create highlight reels table
CREATE TABLE highlight_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  coaching_point_ids UUID[],  -- Array of coaching point IDs
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  is_published BOOLEAN DEFAULT false,
  public_url TEXT -- URL for sharing highlight reel
);
```

**Highlight Segments Player Component:**

> **Design Prompt Integration:**
> 
> You are designing a new feature for a soccer coaching web app called **TACTIX**. The app already has:
> 
> * A working **React YouTube player component** powered by a custom hook (`useYouTubePlayer.ts`) that supports seeking to a time, controlling playback, and tracking current time/duration.
> * A **PostgreSQL schema** (see provided schema.md) that stores games, coaching points (with timestamps, durations, labels, and player tags), and player/guardian relationships.
> 
> The new feature: **Highlight Segments Player**
> 
> * Takes an existing `games.video_id` (YouTube ID) and a list of highlight segments derived from `coaching_points.timestamp` and `coaching_points.duration`.
> * Plays only those highlights in sequence, automatically skipping non-highlight portions.
> * Allows user to manually jump to next/previous highlight.
> * Supports filters:
>   * Only highlights tagged to the logged-in player (`coaching_point_tagged_players.player_id`).
>   * Only highlights for a specific label.
>   * All highlights for the game.
> * Shows segment title (`coaching_points.title`) and optional labels (`labels.name`) on screen while playing.
> * Sends an optional note back to the coach linked to that `coaching_point_id`.
> * Notifies guardians (via existing guardian relationships) when a new highlight for their player is published.
> 
> Technical requirements:
> 
> 1. Use the existing YouTube player hook for playback/seek.
> 2. Accept an array of `{ point_id, startSec, endSec, title, labels[] }` from the backend.
> 3. Implement auto-advance to the next segment when `currentTime >= endSec`.
> 4. Provide UI controls for play/pause, prev/next segment, filter dropdown, and acknowledgement button.
> 5. On acknowledgement, send a POST request to update `coaching_point_acknowledgments` and optionally save a note to a new `notes` field (if implemented).
> 6. Make the component embeddable anywhere a YouTube game video would normally display.
> 
> Output:
> 
> * A **React functional component** implementing this highlight-skipping logic.
> * Integration points to backend for fetching segments, updating views, and sending notes.
> * Clear inline comments explaining how segment switching is handled and how it ties into DB schema.

**Guardian Notification Integration:**
- Trigger notifications when highlights are published
- Use existing `guardian_player_relationships` table
- Send via existing notification system from Feature #5

**Implementation Steps:**
1. Add highlight flag to coaching points
2. Create highlight segments API endpoints
3. Build HighlightSegmentsPlayer React component
4. Implement auto-advance and segment navigation logic
5. Add acknowledgment tracking with notes
6. Integrate with guardian notification system
7. Create public sharing URLs for highlight reels

---

### 4. Filtering & Sorting ✅ **ALREADY PARTIALLY IMPLEMENTED**

**Description:** Players can filter clips: all clips, clips for specific positions (e.g., goalie), or clips tagged with their name.

#### Current Foundation
- CoachingPointsFlyout already has filtering by:
  - Title/content search
  - Tagged players
  - Labels
- Backend API supports complex filtering

#### Implementation Plan

**Database Changes:**
```sql
-- Add position to player profiles or team_players
ALTER TABLE team_players 
ADD COLUMN position TEXT;

-- Or create positions table for better normalization
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE team_players 
ADD COLUMN position_id UUID REFERENCES positions(id);
```

**Backend API Enhancements:**
```typescript
// Extend existing endpoint
GET /api/coaching-points/game/:gameId?player=name&label=defense&position=goalie&tagged_only=true
```

**Frontend Enhancements:**
- Add position dropdown to existing filter UI
- Add "My Clips Only" toggle for players
- Enhance current filtering in CoachingPointsFlyout component
- Add position management in team settings

**Implementation Steps:**
1. Add position field to player data
2. Extend existing filter API endpoints
3. Add position filter to current UI
4. Add position assignment in team management

**Effort Estimate:** Low (1 week) - extends existing filtering system

---

### 5. Guardian Alerts ✅ **HIGHLY FEASIBLE**

**Description:** System alerts guardians when a new clip is tagged with their player's name or position.

#### Current Foundation
- Guardian-player relationships exist
- Player tagging system in place
- Supabase has real-time subscriptions capability

#### Implementation Plan

**Database Changes:**
```sql
-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notification history table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  type TEXT NOT NULL, -- 'new_coaching_point', 'reminder', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  coaching_point_id UUID REFERENCES coaching_points(id),
  sent_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT false
);
```

**Backend API Endpoints:**
```typescript
// New endpoints needed
GET    /api/notifications/:userId                // Get user notifications
POST   /api/notifications/mark-read/:id          // Mark notification as read
PUT    /api/notifications/preferences            // Update notification settings
POST   /api/notifications/test                   // Test notification system
```

**Backend Services:**
```typescript
// Notification service
class NotificationService {
  async notifyGuardians(coachingPointId: string, taggedPlayerIds: string[])
  async sendEmail(userId: string, subject: string, content: string)
  async createNotification(userId: string, type: string, data: any)
}
```

**Frontend Changes:**
- Notification preferences in user settings
- Notification bell/badge in navigation
- Email notification templates
- Real-time notification updates

**Implementation Steps:**
1. Create notification database tables
2. Implement notification service backend
3. Add notification triggers when coaching points are created
4. Build notification UI components
5. Set up email service (Supabase Edge Functions or external service)

**Effort Estimate:** Medium (2-3 weeks) - new notification infrastructure

---

### 6. Tracking & Reporting ✅ **HIGHLY FEASIBLE**

**Description:** System tracks which clips each player has watched & acknowledged. Bar chart view for coach, player, and guardians.

#### Current Foundation
- `coaching_point_acknowledgments` table already tracks acknowledgments
- Existing API endpoints for coaching point data

#### Implementation Plan

**Database Views/Functions:**
```sql
-- Analytics view for coaching point engagement
CREATE VIEW coaching_point_analytics AS
SELECT 
  cp.id,
  cp.title,
  cp.game_id,
  cp.created_at,
  COUNT(cpv.id) as total_views,
  COUNT(CASE WHEN cpv.acknowledged THEN 1 END) as total_acknowledgments,
  COUNT(DISTINCT cpv.player_id) as unique_viewers
FROM coaching_points cp
LEFT JOIN coaching_point_acknowledgments cpv ON cp.id = cpv.point_id
GROUP BY cp.id, cp.title, cp.game_id, cp.created_at;

-- Player progress view
CREATE VIEW player_progress AS
SELECT 
  pp.id as player_id,
  pp.name as player_name,
  COUNT(cptp.coaching_point_id) as total_tagged_points,
  COUNT(cpv.id) as viewed_points,
  COUNT(CASE WHEN cpv.acknowledged THEN 1 END) as acknowledged_points
FROM player_profiles pp
LEFT JOIN coaching_point_tagged_players cptp ON pp.id = cptp.player_id
LEFT JOIN coaching_point_acknowledgments cpv ON cptp.coaching_point_id = cpv.point_id AND pp.id = cpv.player_id
GROUP BY pp.id, pp.name;
```

**Backend API Endpoints:**
```typescript
// Analytics endpoints
GET    /api/analytics/team/:teamId/overview           // Team-wide engagement stats
GET    /api/analytics/team/:teamId/players            // Player progress summary
GET    /api/analytics/player/:playerId/progress       // Individual player detailed stats
GET    /api/analytics/coaching-point/:id/engagement   // Specific coaching point stats
GET    /api/analytics/coach/:coachId/effectiveness    // Coach's coaching point performance
```

**Frontend Components:**
- Analytics dashboard with charts (Chart.js/Recharts)
- Player progress cards
- Team engagement overview
- Individual coaching point analytics
- Time-based progress tracking

**Chart Types:**
- Bar charts for acknowledgment rates
- Line charts for progress over time
- Pie charts for coaching point categories
- Heatmaps for engagement patterns

**Implementation Steps:**
1. Create analytics database views and functions
2. Build analytics API endpoints
3. Choose and integrate charting library
4. Create analytics dashboard components
5. Add analytics navigation and routing

**Effort Estimate:** Medium (2-3 weeks) - new analytics infrastructure

---

### 7. Reminders & Notifications ✅ **HIGHLY FEASIBLE**

**Description:** Automatic alerts to players when new clips are published. Reminders after 2 and 5 days if unwatched. Guardians receive same reminders by default but can unsubscribe.

#### Current Foundation
- User system with email addresses
- Notification foundation from Guardian Alerts (#5)
- Coaching point creation and viewing tracking

#### Implementation Plan

**Database Changes:**
```sql
-- Reminder schedule table
CREATE TABLE reminder_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_point_id UUID REFERENCES coaching_points(id),
  player_id UUID REFERENCES player_profiles(id),
  reminder_type TEXT NOT NULL, -- 'new_point', 'day_2', 'day_5'
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced notification preferences
ALTER TABLE notification_preferences 
ADD COLUMN reminder_notifications BOOLEAN DEFAULT true,
ADD COLUMN reminder_frequency_days INTEGER DEFAULT 2;
```

**Backend Services:**
```typescript
// Reminder service
class ReminderService {
  async scheduleReminders(coachingPointId: string, taggedPlayerIds: string[])
  async processScheduledReminders() // Run by cron job
  async cancelReminders(coachingPointId: string, playerId: string) // When viewed
}

// Background job for processing reminders
// Could use Supabase Edge Functions with cron trigger
export async function processReminders() {
  const dueReminders = await getDueReminders();
  for (const reminder of dueReminders) {
    await sendReminder(reminder);
    await markReminderSent(reminder.id);
  }
}
```

**Backend API Endpoints:**
```typescript
// Reminder management
GET    /api/reminders/user/:userId                // Get user's pending reminders
POST   /api/reminders/schedule                    // Manual reminder scheduling
DELETE /api/reminders/:id                         // Cancel reminder
PUT    /api/reminders/preferences                 // Update reminder preferences
```

**Scheduling Implementation Options:**

**Option 1: Supabase Edge Functions + pg_cron**
```sql
-- Enable pg_cron extension
CREATE EXTENSION pg_cron;

-- Schedule reminder processor
SELECT cron.schedule('process-reminders', '0 9 * * *', 'SELECT process_scheduled_reminders();');
```

**Option 2: External Cron Service**
- Vercel Cron Jobs (if using Vercel)
- GitHub Actions scheduled workflows
- External service like Zapier or n8n

**Frontend Changes:**
- Reminder preferences in user settings
- Unsubscribe links in emails
- Reminder management interface for coaches
- Email templates for different reminder types

**Email Templates:**
- New coaching point notification
- 2-day reminder template
- 5-day reminder template
- Weekly digest template

**Implementation Steps:**
1. Create reminder scheduling system
2. Implement background job processor
3. Create email templates and service
4. Add reminder preferences UI
5. Set up monitoring and error handling

**Effort Estimate:** Medium-High (3-4 weeks) - requires background job infrastructure

---

## Implementation Priority Recommendations

### Phase 1: Quick Wins (4-6 weeks)
1. **Player Acknowledgement & Notes** - Extends existing functionality
2. **Enhanced Filtering & Sorting** - Builds on current filtering
3. **Guardian/Family Following** - Leverages existing relationships

### Phase 2: Core Engagement Features (6-8 weeks)
4. **Tracking & Reporting** - Provides valuable insights
5. **Guardian Alerts** - Real-time engagement

### Phase 3: Advanced Features (8-12 weeks)
6. **Reminders & Notifications** - Requires background job infrastructure
7. **Automatic Highlight Reels** - Requires external integration clarification

## Technical Considerations

### Infrastructure Requirements
- **Background Jobs:** Needed for reminders and notifications
- **Email Service:** Supabase Edge Functions or external provider (SendGrid, Mailgun)
- **Real-time Updates:** Supabase subscriptions for notifications
- **Video Processing:** For highlight reel compilation
- **Analytics Storage:** May need data warehouse for large-scale analytics

### Performance Considerations
- Database indexing for analytics queries
- Caching for frequently accessed data
- Efficient notification batching
- Rate limiting for email sending

### Security Considerations
- Extend RLS policies for new features
- Email unsubscribe token security
- Notification permission verification
- Guardian access control validation

## External Dependencies

### Clarifications Needed
1. **"Ollie" Integration** - What is Ollie? API documentation needed
2. **Email Service Preference** - Which email provider to use?
3. **Video Processing** - Do we need server-side video compilation for highlight reels?
4. **Background Jobs** - Preference for scheduling infrastructure?

### Third-Party Services
- Email service provider
- Video processing service (if needed)
- Analytics/monitoring tools
- Push notification service (optional)

## Conclusion

All requested features are feasible with the current TACTIX architecture. The system's solid foundation with proper database relationships, role-based access control, and modular React/Express structure makes it well-positioned for these enhancements.

The features can be implemented incrementally, with each phase building on the previous one. The recommended phased approach allows for early value delivery while building toward the more complex features that require additional infrastructure.

Total estimated implementation time: **12-16 weeks** for all features, depending on external integration complexity and infrastructure choices.
