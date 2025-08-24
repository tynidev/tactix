# Feature 3: Automatic Coaching Point Reels ✅ **HIGHLY FEASIBLE**

**Description:** Coach tags a coaching point as a "highlight." System automatically creates a reel of all points marked as highlights and provides a coaching points reel player.

## Current Foundation
- Video player and coaching point system in place
- Existing YouTube player hook (`useYouTubePlayer.ts`) with seeking/playback control
- Existing Coaching Point playback hook (`useCoachingPointPlayback.ts`) with ability to re-play a coaching point

## Enhanced Implementation Plan

Existing Schema: `docs\schema.md`

### Database Changes
```sql
-- Add highlight flag to coaching points
ALTER TABLE coaching_points 
ADD COLUMN is_highlight BOOLEAN DEFAULT false;

-- Create clip coaching_point_reels table
CREATE TABLE coaching_point_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT,
  coaching_point_ids UUID[],  -- Array of coaching point IDs
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  is_published BOOLEAN DEFAULT false,
  reel_id UNIQUE NOT NULL -- A 6-character, case-sensitive string consisting of uppercase letters (A-Z), lowercase letters (a-z), numbers (0-9), and the special characters - and _
);
```

### Backend API Endpoints
```typescript
// Modify existing endpoints
POST   /api/coaching-points/:id         // Utilize existing API and just add field to POST `is_highlight`

// Endpoints needed
POST   /api/coaching-points/reel                // Create compilation
GET    /api/coaching-points/reel/:id            // Get coaching point reel, including all points in order and youtube video id for each one from games table
GET    /api/coaching-points/game/:id/highlights // Get all coaching points marked as highlights for a given game
```

## Coaching Point Modal enhancement
- Extend `CoachingPointModal.tsx` to coach to mark the coaching point as a highlight (which sets `is_highlight` on POST)

## Coaching Point Reel Player Component

> **Design Prompt:**
> 
> You are designing a new feature for a soccer coaching web app called **TACTIX**.
> 
> The new feature: **Coaching Point Reel Player**
> 
> * Takes an a list of `coaching_points` and cycles through each one
>   * Loading the youtube video attached to the game
>   * Loading the coaching point and playing it
> * Plays only those coaching points in sequence.
> * Allows user to manually jump to next/previous coaching point.
> * Shows title (`coaching_points.title`) on screen while playing.
> 
> Technical requirements:
> 
> 1. Use the existing `useCoachingPointPlayback.ts` for playing back the coaching points
> 2. Accept an array of `{ point_id, startSec, endSec, title, labels[] }` from the backend.
> 3. Implement auto-advance to the next coaching point when `currentTime >= endSec`.
> 4. Provide UI controls for play/pause, prev/next point
> 
> Output:
> 
> * A **React functional component** implementing this coaching point skipping logic.
> * Integration points to backend for coaching points tied to a reel, updating views
```

## User Stories
1. **As a coach**, I want to mark coaching points as highlights so players can focus on key moments
2. **As a player**, I want to watch only highlights/reels so I can efficiently view relevant moments
3. **As a player**, I want highlights/reels to play automatically so I don't miss important moments