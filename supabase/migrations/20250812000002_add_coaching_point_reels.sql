-- Add highlight flag to coaching points and create coaching point reels table
-- Migration for Feature 3: Automatic Coaching Point Reels

-- Add highlight flag to existing coaching_points table
ALTER TABLE coaching_points 
ADD COLUMN is_highlight BOOLEAN DEFAULT false;

-- Create coaching_point_reels table
CREATE TABLE public.coaching_point_reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    coaching_point_ids UUID[] NOT NULL DEFAULT '{}', -- Array of coaching point IDs in playback order
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_published BOOLEAN DEFAULT false,
    reel_id TEXT UNIQUE NOT NULL -- 6-character case-sensitive string (A-Z, a-z, 0-9, -, _)
);

-- Enable RLS
ALTER TABLE public.coaching_point_reels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_point_reels
CREATE POLICY "Team members can view reels" ON public.coaching_point_reels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage reels" ON public.coaching_point_reels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- Indexes for performance
CREATE INDEX idx_coaching_point_reels_team_id ON public.coaching_point_reels(team_id);
CREATE INDEX idx_coaching_point_reels_reel_id ON public.coaching_point_reels(reel_id);
CREATE INDEX idx_coaching_point_reels_created_by ON public.coaching_point_reels(created_by);
CREATE INDEX idx_coaching_point_reels_is_published ON public.coaching_point_reels(is_published) WHERE is_published = true;

-- Add index for highlights on coaching_points
CREATE INDEX idx_coaching_points_is_highlight ON public.coaching_points(is_highlight) WHERE is_highlight = true;

-- Function to generate unique reel codes
CREATE OR REPLACE FUNCTION public.generate_reel_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate reel ID if not provided
CREATE OR REPLACE FUNCTION public.set_reel_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reel_id IS NULL OR NEW.reel_id = '' THEN
        LOOP
            NEW.reel_id := public.generate_reel_id();
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coaching_point_reels WHERE reel_id = NEW.reel_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate reel IDs
CREATE TRIGGER set_reel_id_trigger
    BEFORE INSERT ON public.coaching_point_reels
    FOR EACH ROW EXECUTE FUNCTION public.set_reel_id();
