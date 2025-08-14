-- Phase 2: Coaching Point View Analytics Implementation
-- This migration creates a hybrid system for tracking coaching point views:
-- 1. coaching_point_view_summary: Quick lookups for UI (has user viewed this?)
-- 2. coaching_point_view_events: Detailed analytics with completion tracking

-- Create summary table for quick lookups
CREATE TABLE public.coaching_point_view_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.coaching_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 0,
    first_viewed_at TIMESTAMP WITH TIME ZONE,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(point_id, user_id)
);

-- Create events table for detailed analytics
CREATE TABLE public.coaching_point_view_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.coaching_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_view_summary_point_user ON public.coaching_point_view_summary(point_id, user_id);
CREATE INDEX idx_view_summary_user ON public.coaching_point_view_summary(user_id);
CREATE INDEX idx_view_events_point_user ON public.coaching_point_view_events(point_id, user_id);
CREATE INDEX idx_view_events_created_at ON public.coaching_point_view_events(created_at);
CREATE INDEX idx_view_events_user ON public.coaching_point_view_events(user_id);

-- Function to update summary table when events are inserted
CREATE OR REPLACE FUNCTION public.update_view_summary()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.coaching_point_view_summary (point_id, user_id, view_count, first_viewed_at, last_viewed_at)
    VALUES (NEW.point_id, NEW.user_id, 1, NOW(), NOW())
    ON CONFLICT (point_id, user_id) 
    DO UPDATE SET 
        view_count = coaching_point_view_summary.view_count + 1,
        last_viewed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update summary when events are created
CREATE TRIGGER update_view_summary_trigger
AFTER INSERT ON public.coaching_point_view_events
FOR EACH ROW EXECUTE FUNCTION public.update_view_summary();

-- Function to clean up old view events (can be called manually or via cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_view_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.coaching_point_view_events 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Deleted % old view events', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for coaching_point_view_summary
ALTER TABLE public.coaching_point_view_summary ENABLE ROW LEVEL SECURITY;

-- Users can view their own summary records
CREATE POLICY "Users can view their own view summaries" ON public.coaching_point_view_summary
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own view summaries (handled by trigger, but needed for RLS)
CREATE POLICY "Users can create their own view summaries" ON public.coaching_point_view_summary
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own view summaries (handled by trigger, but needed for RLS)
CREATE POLICY "Users can update their own view summaries" ON public.coaching_point_view_summary
    FOR UPDATE USING (auth.uid() = user_id);

-- Coaches can view all summaries for their team's coaching points
CREATE POLICY "Coaches can view team view summaries" ON public.coaching_point_view_summary
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = coaching_point_view_summary.point_id
            AND tm.user_id = auth.uid()
            AND tm.role = 'coach'
        )
    );

-- RLS Policies for coaching_point_view_events
ALTER TABLE public.coaching_point_view_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own event records
CREATE POLICY "Users can view their own view events" ON public.coaching_point_view_events
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own view events
CREATE POLICY "Users can create their own view events" ON public.coaching_point_view_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own view events (for completion percentage updates)
CREATE POLICY "Users can update their own view events" ON public.coaching_point_view_events
    FOR UPDATE USING (auth.uid() = user_id);

-- Coaches can view all events for their team's coaching points
CREATE POLICY "Coaches can view team view events" ON public.coaching_point_view_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = coaching_point_view_events.point_id
            AND tm.user_id = auth.uid()
            AND tm.role = 'coach'
        )
    );

-- Helper function to get unviewed coaching points for a user
CREATE OR REPLACE FUNCTION public.get_unviewed_coaching_points(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    game_id UUID,
    title TEXT,
    feedback TEXT,
    "timestamp" INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id,
        cp.game_id,
        cp.title,
        cp.feedback,
        cp."timestamp",
        cp.created_at
    FROM public.coaching_points cp
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coaching_point_view_summary vs
        WHERE vs.point_id = cp.id
        AND vs.user_id = p_user_id
    )
    AND EXISTS (
        SELECT 1 FROM public.games g
        JOIN public.team_memberships tm ON g.team_id = tm.team_id
        WHERE g.id = cp.game_id
        AND tm.user_id = p_user_id
    )
    ORDER BY cp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_unviewed_coaching_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_view_events TO authenticated;
