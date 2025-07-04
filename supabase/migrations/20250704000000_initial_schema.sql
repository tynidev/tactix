-- Initial schema creation for TACTIX application

-- Create custom types
CREATE TYPE team_role AS ENUM ('coach', 'player', 'admin', 'parent');
CREATE TYPE game_type AS ENUM ('regular', 'tournament', 'scrimmage');
CREATE TYPE home_away AS ENUM ('home', 'away', 'neutral');
CREATE TYPE event_type AS ENUM ('play', 'pause', 'seek', 'draw', 'change_speed');

-- Users table (integrated with Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team memberships
CREATE TABLE team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_role NOT NULL,
    UNIQUE(team_id, user_id)
);

-- Parent-child relationships
CREATE TABLE parent_child_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_id, child_id),
    CHECK (parent_id != child_id)
);

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    opponent TEXT NOT NULL,
    date DATE NOT NULL,
    location TEXT NOT NULL,
    video_id VARCHAR(11) NOT NULL, -- YouTube video ID
    team_score INTEGER NOT NULL CHECK (team_score >= 0),
    opp_score INTEGER NOT NULL CHECK (opp_score >= 0),
    game_type game_type NOT NULL,
    home_away home_away NOT NULL,
    notes TEXT
);

-- Coaching points
CREATE TABLE coaching_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    feedback TEXT NOT NULL,
    timestamp TIME NOT NULL, -- Time in video
    audio_url TEXT,
    duration INTEGER NOT NULL, -- Duration in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coaching point events (for recording sessions)
CREATE TABLE coaching_point_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES coaching_points(id) ON DELETE CASCADE,
    event_type event_type NOT NULL,
    timestamp INTEGER NOT NULL, -- Milliseconds from recording start
    event_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tagged users for coaching points
CREATE TABLE coaching_point_tagged_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES coaching_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(point_id, user_id)
);

-- Labels for categorizing coaching points
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, name)
);

-- Labels applied to coaching points
CREATE TABLE coaching_point_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES coaching_points(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(point_id, label_id)
);

-- Tracking views and acknowledgments
CREATE TABLE coaching_point_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES coaching_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    ack_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(point_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_user_id ON team_memberships(user_id);
CREATE INDEX idx_games_team_id ON games(team_id);
CREATE INDEX idx_coaching_points_game_id ON coaching_points(game_id);
CREATE INDEX idx_coaching_points_author_id ON coaching_points(author_id);
CREATE INDEX idx_coaching_point_events_point_id ON coaching_point_events(point_id);
CREATE INDEX idx_coaching_point_tagged_users_point_id ON coaching_point_tagged_users(point_id);
CREATE INDEX idx_coaching_point_tagged_users_user_id ON coaching_point_tagged_users(user_id);
CREATE INDEX idx_coaching_point_views_point_id ON coaching_point_views(point_id);
CREATE INDEX idx_coaching_point_views_user_id ON coaching_point_views(user_id);
