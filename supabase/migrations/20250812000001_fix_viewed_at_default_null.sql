-- Migration to fix viewed_at field in coaching_point_views table
-- The viewed_at field should default to NULL and only be set when actually viewed by the system

-- ==========================================
-- RESET EXISTING DATA
-- ==========================================

-- Reset all existing viewed_at values to NULL since they were incorrectly auto-populated
UPDATE public.coaching_point_views 
SET viewed_at = NULL;

-- ==========================================
-- FIX COLUMN DEFAULT
-- ==========================================

-- Remove the automatic DEFAULT NOW() constraint
ALTER TABLE public.coaching_point_views 
ALTER COLUMN viewed_at DROP DEFAULT;

-- Set the default to NULL (this is the correct behavior for an optional field)
ALTER TABLE public.coaching_point_views 
ALTER COLUMN viewed_at SET DEFAULT NULL;

-- ==========================================
-- ADD DOCUMENTATION
-- ==========================================

-- Update the column comment to clarify when this field should be set
COMMENT ON COLUMN public.coaching_point_views.viewed_at IS 
'Timestamp when the coaching point was actually viewed by the system. NULL indicates not yet viewed. Should only be set programmatically when the system records a view event.';
