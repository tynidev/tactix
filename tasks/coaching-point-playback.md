I'll analyze the current implementation and create a comprehensive step-by-step plan for implementing coaching point playback with synchronized events.

## Step-by-Step Implementation Plan for Coaching Point Playback

### Phase 1: Data Structure & API Integration

**Files to examine/modify:**
- `/frontend/src/types/coaching.ts` (create if doesn't exist)
- `/frontend/src/api/coachingPoints.ts` (examine/modify)
- GameAnalysis.tsx

**Steps:**
1. Define TypeScript interfaces for coaching point events:
   - `CoachingPointEvent` interface with types: 'play', 'pause', 'seek', 'speed', 'draw'
   - Each event type should have timestamp and specific data
2. Update `CoachingPoint` interface to include `coaching_point_events` array
3. Ensure API fetches coaching point events along with coaching points

### Phase 2: Create Playback Controller Hook

**Files to create:**
- `/frontend/src/hooks/useCoachingPointPlayback.ts`

**Steps:**
1. Create a custom hook that manages:
   - Audio playback state
   - Event queue processing
   - Synchronization between audio time and events
   - Methods: `startPlayback()`, `pausePlayback()`, `stopPlayback()`
2. Implement event scheduling logic:
   - Sort events by timestamp
   - Use `requestAnimationFrame` or `setInterval` to check current audio time
   - Execute events when audio reaches their timestamps

Looking at the existing implementation in GameAnalysis.tsx, I can see that the coaching point sidebar is already embedded directly in the component (lines 391-443). Let me modify Phase 3 to consider both options:

## Phase 3: Update Coaching Point Sidebar

**Extract to dedicated component (Recommended)**

**Files to create/modify:**
- `/frontend/src/components/CoachingPointSidebar/CoachingPointSidebar.tsx` (create)
- `/frontend/src/components/CoachingPointSidebar/CoachingPointSidebar.css` (create)
- GameAnalysis.tsx (modify)

**Steps:**
1. Extract lines 391-443 from GameAnalysis.tsx into new `CoachingPointSidebar` component
2. Add props interface:
   ```typescript
   interface CoachingPointSidebarProps {
     coachingPoint: CoachingPoint;
     onClose: () => void;
     onPlaybackStart: () => void;
     onPlaybackEnd: () => void;
     videoPlayer: any; // YouTube player instance
     onDrawingUpdate: (drawings: Drawing[]) => void;
     onVideoControl: (action: string, data?: any) => void;
   }
   ```
3. Add playback UI controls:
   - Audio playback button (Play/Pause)
   - Progress bar with current/total time
   - "Stop Playback" button
   - Visual indicator for active playback
   - Indication of how many coaching_point_events there are
   - Indicator of when an individual coaching_point_event is handled during playback
4. Integrate `useCoachingPointPlayback` hook inside the sidebar component
5. Replace existing sidebar JSX in GameAnalysis.tsx with new component

### Phase 4: Implement Event Handlers

**Files to modify:**
- GameAnalysis.tsx
- useDrawingCanvas.ts (examine)
- useYouTubePlayer.ts (examine)

**Steps:**
1. Create event handler functions for each event type:
   - `handlePlayEvent`: Resume video playback
   - `handlePauseEvent`: Pause video
   - `handleSeekEvent`: Seek video to specific time
   - `handleSpeedEvent`: Change playback speed
   - `handleDrawEvent`: Update canvas with drawing data
2. Pass these handlers to the playback controller
3. Ensure proper cleanup when playback stops

### Phase 5: Synchronization Logic

**Files to modify:**
- `/frontend/src/hooks/useCoachingPointPlayback.ts`
- GameAnalysis.tsx

**Steps:**
1. Implement audio-video sync mechanism:
   - Account for network delays
   - Handle buffering states
   - Implement catch-up logic if events fall behind
2. Add error handling for failed events
3. Implement cleanup on component unmount or coaching point change

### Phase 6: UI/UX Enhancements

**Files to modify:**
- `/frontend/src/components/CoachingPointSidebar/CoachingPointSidebar.tsx`
- GameAnalysis.css

**Steps:**
1. Add visual indicators:
   - "Playback in progress" indicator
   - Event timeline visualization (optional)
   - Loading states for audio
2. Disable conflicting controls during playback:
   - Drawing tools
   - Manual video controls
   - Other coaching point selections
3. Add "Stop Playback" button to exit playback mode

### Implementation Order:
1. Start with Phase 1 to ensure data structures are correct
2. Implement Phase 2 (playback hook) as the core functionality
3. Build Phase 3 (UI components) to interact with the hook
4. Implement Phase 4 (event handlers) to execute the events
5. Add Phase 5 (synchronization) for smooth playback
6. Polish with Phase 6 (UI/UX)

### Key Considerations:
- Audio playback should drive the timeline (master clock)
- Events should be queued and executed based on audio currentTime
- Provide clear visual feedback during playback
- Allow interruption/cancellation of playback at any time
- Ensure drawings are cleared before starting playback
- Handle cases where audio URL is invalid or unavailable