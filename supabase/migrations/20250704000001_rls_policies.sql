-- Row Level Security Policies for TACTIX application

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_point_tagged_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_point_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_point_views ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR ALL USING (auth.uid() = id);

-- Teams policies  
CREATE POLICY "Team members can view their teams" ON teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can update their teams" ON teams
    FOR UPDATE USING (
        id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('coach', 'admin')
        )
    );

CREATE POLICY "Coaches can create teams" ON teams
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Team memberships policies
CREATE POLICY "Users can view memberships for their teams" ON team_memberships
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage team memberships" ON team_memberships
    FOR ALL USING (
        team_id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('coach', 'admin')
        )
    );

-- Parent-child relationships policies
CREATE POLICY "Parents can view their relationships" ON parent_child_relationships
    FOR ALL USING (parent_id = auth.uid());

CREATE POLICY "Children can view their parent relationships" ON parent_child_relationships
    FOR SELECT USING (child_id = auth.uid());

-- Games policies
CREATE POLICY "Team members can view their team's games" ON games
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage games" ON games
    FOR ALL USING (
        team_id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('coach', 'admin')
        )
    );

-- Coaching points policies
CREATE POLICY "Team members can view coaching points for their games" ON coaching_points
    FOR SELECT USING (
        game_id IN (
            SELECT g.id FROM games g
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can create and edit coaching points" ON coaching_points
    FOR ALL USING (
        game_id IN (
            SELECT g.id FROM games g
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
        OR author_id = auth.uid()
    );

-- Coaching point events policies
CREATE POLICY "Users can view events for accessible coaching points" ON coaching_point_events
    FOR SELECT USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can manage coaching point events" ON coaching_point_events
    FOR ALL USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- Tagged users policies
CREATE POLICY "Users can view tags for accessible coaching points" ON coaching_point_tagged_users
    FOR SELECT USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can manage tagged users" ON coaching_point_tagged_users
    FOR ALL USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- Labels policies
CREATE POLICY "Team members can view their team's labels" ON labels
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches and admins can manage labels" ON labels
    FOR ALL USING (
        team_id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid() 
            AND role IN ('coach', 'admin')
        )
    );

-- Coaching point labels policies
CREATE POLICY "Users can view labels for accessible coaching points" ON coaching_point_labels
    FOR SELECT USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Coaches can manage coaching point labels" ON coaching_point_labels
    FOR ALL USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- Coaching point views policies
CREATE POLICY "Users can view their own viewing history" ON coaching_point_views
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Coaches can view team members' viewing history" ON coaching_point_views
    FOR SELECT USING (
        point_id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN games g ON cp.game_id = g.id
            JOIN team_memberships tm ON g.team_id = tm.team_id
            WHERE tm.user_id = auth.uid() 
            AND tm.role IN ('coach', 'admin')
        )
    );

-- Parents can view their children's coaching points
CREATE POLICY "Parents can view their children's coaching points" ON coaching_points
    FOR SELECT USING (
        id IN (
            SELECT cp.id FROM coaching_points cp
            JOIN coaching_point_tagged_users cptu ON cp.id = cptu.point_id
            JOIN parent_child_relationships pcr ON cptu.user_id = pcr.child_id
            WHERE pcr.parent_id = auth.uid()
        )
    );

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record when auth user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
