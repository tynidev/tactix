-- Add 'recording_start' to the event_type enum
-- This event type will store the initial state when a coaching point recording begins

-- Add the new value to the event_type enum
ALTER TYPE public.event_type ADD VALUE 'recording_start';

-- Add a comment explaining the event_data format for this event type
COMMENT ON TYPE public.event_type IS 
'Event types for coaching point events:
- play: Video playback started
- pause: Video playback paused  
- seek: Video position changed
- draw: Drawing action performed
- change_speed: Playback speed changed
- recording_start: Recording session initiated with initial state (event_data should contain: playbackSpeed, videoTimestamp, existingDrawings)';
