-- Migration to change coaching_points.timestamp from TIME to INTEGER
-- This will store the timestamp as milliseconds from the start of the video

-- First, add a new column with the correct type
ALTER TABLE public.coaching_points 
ADD COLUMN timestamp_ms INTEGER;

-- Convert existing TIME values to milliseconds
-- Extract hours, minutes, seconds from TIME and convert to total milliseconds
UPDATE public.coaching_points 
SET timestamp_ms = (
    EXTRACT(HOUR FROM timestamp) * 3600000 +
    EXTRACT(MINUTE FROM timestamp) * 60000 +
    EXTRACT(SECOND FROM timestamp) * 1000
)::INTEGER
WHERE timestamp IS NOT NULL;

-- Drop the old column
ALTER TABLE public.coaching_points 
DROP COLUMN timestamp;

-- Rename the new column to timestamp
ALTER TABLE public.coaching_points 
RENAME COLUMN timestamp_ms TO timestamp;

-- Add a comment to document the change
COMMENT ON COLUMN public.coaching_points.timestamp IS 'Video timestamp in milliseconds from the start of the video';
