-- Migration to add notes field to coaching_point_views table
-- This supports Feature 1: Player Acknowledgement & Notes

-- ==========================================
-- ADD NOTES COLUMN
-- ==========================================

-- Add notes column to coaching_point_views table
ALTER TABLE public.coaching_point_views
ADD COLUMN notes TEXT
    CONSTRAINT coaching_point_views_notes_len_chk
    CHECK (notes IS NULL OR char_length(notes) <= 1024);

-- ==========================================
-- ADD DOCUMENTATION
-- ==========================================

-- Add comment to document the field
COMMENT ON COLUMN public.coaching_point_views.notes IS 
'Player notes about what they learned from the coaching point (max ~1024 chars recommended)';

-- Update the RLS policies to allow guardians to acknowledge on behalf of their players
-- First, let's check if we need to add any new policies for guardian proxy acknowledgments

-- Allow guardians to view coaching point views for their managed players
CREATE POLICY "Guardians can view coaching point views for their players" ON public.coaching_point_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.guardian_player_relationships gpr
            WHERE gpr.guardian_id = auth.uid() 
            AND gpr.player_profile_id = coaching_point_views.player_id
        )
    );

-- Allow guardians to update coaching point views for their managed players
CREATE POLICY "Guardians can update coaching point views for their players" ON public.coaching_point_views
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.guardian_player_relationships gpr
            WHERE gpr.guardian_id = auth.uid() 
            AND gpr.player_profile_id = coaching_point_views.player_id
        )
    );

-- Allow guardians to insert coaching point views for their managed players
CREATE POLICY "Guardians can insert coaching point views for their players" ON public.coaching_point_views
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.guardian_player_relationships gpr
            WHERE gpr.guardian_id = auth.uid() 
            AND gpr.player_profile_id = coaching_point_views.player_id
        )
    );
