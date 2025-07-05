-- Initial schema migration for TactixHUD
-- Creates all tables, enums, and RLS policies

-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Create custom types/enums
CREATE TYPE public.team_role AS ENUM ('coach', 'player', 'admin', 'guardian');
CREATE TYPE public.game_type AS ENUM ('regular', 'tournament', 'scrimmage');
CREATE TYPE public.home_away AS ENUM ('home', 'away', 'neutral');
CREATE TYPE public.event_type AS ENUM ('play', 'pause', 'seek', 'draw', 'change_speed');

-- ==========================================
-- USER PROFILES TABLE
-- ==========================================
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ==========================================
-- TEAMS TABLE
-- ==========================================
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TEAM MEMBERSHIPS TABLE
-- ==========================================
CREATE TABLE public.team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role public.team_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams (based on team membership)
CREATE POLICY "Team members can view their teams" ON public.teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can update teams" ON public.teams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

CREATE POLICY "Authenticated users can create teams" ON public.teams
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for team_memberships
CREATE POLICY "Team members can view team memberships" ON public.team_memberships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage team memberships" ON public.team_memberships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- TEAM JOIN CODES TABLE
-- ==========================================
CREATE TABLE public.team_join_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    team_role public.team_role,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.team_join_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_join_codes
CREATE POLICY "Team members can view join codes" ON public.team_join_codes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage join codes" ON public.team_join_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- PLAYER PROFILES TABLE
-- ==========================================
CREATE TABLE public.player_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    jersey_number TEXT,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TEAM PLAYERS TABLE
-- ==========================================
CREATE TABLE public.team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, player_id)
);

-- Enable RLS
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_players
CREATE POLICY "Team members can view team players" ON public.team_players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage team players" ON public.team_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- Add player_profiles RLS policies now that team_players exists
CREATE POLICY "Team members can view players" ON public.player_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_players tp
            JOIN public.team_memberships tm ON tp.team_id = tm.team_id
            WHERE tp.player_id = player_profiles.id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own player profile" ON public.player_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Coaches and admins can manage players" ON public.player_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_players tp
            JOIN public.team_memberships tm ON tp.team_id = tm.team_id
            WHERE tp.player_id = player_profiles.id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- GUARDIAN PLAYER RELATIONSHIPS TABLE
-- ==========================================
CREATE TABLE public.guardian_player_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    player_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    player_profile_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guardian_id, player_profile_id)
);

-- Enable RLS
ALTER TABLE public.guardian_player_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for guardian_player_relationships
CREATE POLICY "Guardians can view their relationships" ON public.guardian_player_relationships
    FOR SELECT USING (guardian_id = auth.uid());

CREATE POLICY "Players can view their guardian relationships" ON public.guardian_player_relationships
    FOR SELECT USING (player_user_id = auth.uid());

CREATE POLICY "Coaches and admins can view relationships for their team players" ON public.guardian_player_relationships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_players tp
            JOIN public.team_memberships tm ON tp.team_id = tm.team_id
            WHERE tp.player_id = player_profile_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

CREATE POLICY "Guardians can manage their relationships" ON public.guardian_player_relationships
    FOR ALL USING (guardian_id = auth.uid());

-- ==========================================
-- GAMES TABLE
-- ==========================================
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    opponent TEXT NOT NULL,
    date DATE NOT NULL,
    location TEXT,
    video_id VARCHAR(11),
    team_score INTEGER CHECK (team_score >= 0),
    opp_score INTEGER CHECK (opp_score >= 0),
    game_type public.game_type DEFAULT 'regular',
    home_away public.home_away DEFAULT 'home',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games
CREATE POLICY "Team members can view games" ON public.games
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage games" ON public.games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- LABELS TABLE
-- ==========================================
CREATE TABLE public.labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, name)
);

-- Enable RLS
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for labels
CREATE POLICY "Team members can view labels" ON public.labels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage labels" ON public.labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships tm 
            WHERE tm.team_id = team_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- COACHING POINTS TABLE
-- ==========================================
CREATE TABLE public.coaching_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    feedback TEXT,
    timestamp TIME,
    audio_url TEXT,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coaching_points ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_points
CREATE POLICY "Team members can view coaching points" ON public.coaching_points
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE g.id = game_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage coaching points" ON public.coaching_points
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.games g
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE g.id = game_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- COACHING POINT EVENTS TABLE
-- ==========================================
CREATE TABLE public.coaching_point_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.coaching_points(id) ON DELETE CASCADE,
    event_type public.event_type NOT NULL,
    timestamp INTEGER NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coaching_point_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_point_events
CREATE POLICY "Team members can view coaching point events" ON public.coaching_point_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage coaching point events" ON public.coaching_point_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- COACHING POINT TAGGED PLAYERS TABLE
-- ==========================================
CREATE TABLE public.coaching_point_tagged_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.coaching_points(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(point_id, player_id)
);

-- Enable RLS
ALTER TABLE public.coaching_point_tagged_players ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_point_tagged_players
CREATE POLICY "Team members can view tagged players" ON public.coaching_point_tagged_players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage tagged players" ON public.coaching_point_tagged_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- COACHING POINT LABELS TABLE
-- ==========================================
CREATE TABLE public.coaching_point_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.coaching_points(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(point_id, label_id)
);

-- Enable RLS
ALTER TABLE public.coaching_point_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_point_labels
CREATE POLICY "Team members can view coaching point labels" ON public.coaching_point_labels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage coaching point labels" ON public.coaching_point_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- ==========================================
-- COACHING POINT VIEWS TABLE
-- ==========================================
CREATE TABLE public.coaching_point_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.coaching_points(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false,
    ack_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(point_id, player_id)
);

-- Enable RLS
ALTER TABLE public.coaching_point_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_point_views
CREATE POLICY "Players can view their own coaching point views" ON public.coaching_point_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.player_profiles pp
            WHERE pp.id = player_id AND pp.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can view all coaching point views for their team" ON public.coaching_point_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.coaching_points cp
            JOIN public.games g ON cp.game_id = g.id
            JOIN public.team_memberships tm ON g.team_id = tm.team_id
            WHERE cp.id = point_id AND tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

CREATE POLICY "Players can update their own coaching point views" ON public.coaching_point_views
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.player_profiles pp
            WHERE pp.id = player_id AND pp.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert coaching point views" ON public.coaching_point_views
    FOR INSERT WITH CHECK (true);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- User profiles
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

-- Team memberships
CREATE INDEX idx_team_memberships_team_id ON public.team_memberships(team_id);
CREATE INDEX idx_team_memberships_user_id ON public.team_memberships(user_id);

-- Team join codes
CREATE INDEX idx_team_join_codes_code ON public.team_join_codes(code);
CREATE INDEX idx_team_join_codes_team_id ON public.team_join_codes(team_id);
CREATE INDEX idx_team_join_codes_active ON public.team_join_codes(is_active) WHERE is_active = true;

-- Player profiles
CREATE INDEX idx_player_profiles_user_id ON public.player_profiles(user_id);

-- Team players
CREATE INDEX idx_team_players_team_id ON public.team_players(team_id);
CREATE INDEX idx_team_players_player_id ON public.team_players(player_id);

-- Guardian relationships
CREATE INDEX idx_guardian_relationships_guardian_id ON public.guardian_player_relationships(guardian_id);
CREATE INDEX idx_guardian_relationships_player_user_id ON public.guardian_player_relationships(player_user_id);
CREATE INDEX idx_guardian_relationships_player_profile_id ON public.guardian_player_relationships(player_profile_id);

-- Games
CREATE INDEX idx_games_team_id ON public.games(team_id);
CREATE INDEX idx_games_date ON public.games(date);
CREATE INDEX idx_games_video_id ON public.games(video_id);

-- Coaching points
CREATE INDEX idx_coaching_points_game_id ON public.coaching_points(game_id);
CREATE INDEX idx_coaching_points_author_id ON public.coaching_points(author_id);
CREATE INDEX idx_coaching_points_created_at ON public.coaching_points(created_at);

-- Coaching point events
CREATE INDEX idx_coaching_point_events_point_id ON public.coaching_point_events(point_id);
CREATE INDEX idx_coaching_point_events_timestamp ON public.coaching_point_events(timestamp);

-- Labels
CREATE INDEX idx_labels_team_id ON public.labels(team_id);

-- Coaching point tagged players
CREATE INDEX idx_coaching_point_tagged_players_point_id ON public.coaching_point_tagged_players(point_id);
CREATE INDEX idx_coaching_point_tagged_players_player_id ON public.coaching_point_tagged_players(player_id);

-- Coaching point labels
CREATE INDEX idx_coaching_point_labels_point_id ON public.coaching_point_labels(point_id);
CREATE INDEX idx_coaching_point_labels_label_id ON public.coaching_point_labels(label_id);

-- Coaching point views
CREATE INDEX idx_coaching_point_views_point_id ON public.coaching_point_views(point_id);
CREATE INDEX idx_coaching_point_views_player_id ON public.coaching_point_views(player_id);
CREATE INDEX idx_coaching_point_views_acknowledged ON public.coaching_point_views(acknowledged);

-- ==========================================
-- TRIGGERS AND FUNCTIONS
-- ==========================================

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate unique join codes
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate join code if not provided
CREATE OR REPLACE FUNCTION public.set_join_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        LOOP
            NEW.code := public.generate_join_code();
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.team_join_codes WHERE code = NEW.code);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join codes
CREATE TRIGGER set_join_code_trigger
    BEFORE INSERT ON public.team_join_codes
    FOR EACH ROW EXECUTE FUNCTION public.set_join_code();
