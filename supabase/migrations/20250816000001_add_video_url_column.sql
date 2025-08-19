-- Add video_url column to games table
-- Keep video_id column for now to allow rollback if needed

-- Add the new video_url column
ALTER TABLE public.games 
ADD COLUMN video_url TEXT;

-- Create index for the new column
CREATE INDEX idx_games_video_url ON public.games(video_url);

-- Update RLS policies to include video_url (they should work automatically since they use *)
-- No policy changes needed as existing policies use wildcard selectors

-- Add comment to document the migration
COMMENT ON COLUMN public.games.video_url IS 'Full video URL (YouTube or MP4). Replaces video_id column.';
COMMENT ON COLUMN public.games.video_id IS 'DEPRECATED: YouTube video ID. Use video_url instead.';