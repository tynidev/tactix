export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined; }
  | Json[];

export enum TeamRole
{
  Coach = 'coach',
  Player = 'player',
  Admin = 'admin',
  Parent = 'parent',
}

export enum GameType
{
  Regular = 'regular',
  Tournament = 'tournament',
  Scrimmage = 'scrimmage',
}

export enum HomeAway
{
  Home = 'home',
  Away = 'away',
  Neutral = 'neutral',
}

export enum CoachingPointEventType
{
  Play = 'play',
  Pause = 'pause',
  Seek = 'seek',
  Draw = 'draw',
  ChangeSpeed = 'change_speed',
}

export interface Database
{
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          created_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      team_memberships: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: TeamRole;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role: TeamRole;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: TeamRole;
        };
      };
      parent_child_relationships: {
        Row: {
          id: string;
          parent_id: string;
          child_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          child_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          child_id?: string;
          created_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          team_id: string;
          opponent: string;
          date: string;
          location: string;
          video_id: string;
          team_score: number;
          opp_score: number;
          game_type: GameType;
          home_away: HomeAway;
          notes: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          opponent: string;
          date: string;
          location: string;
          video_id: string;
          team_score: number;
          opp_score: number;
          game_type: GameType;
          home_away: HomeAway;
          notes?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          opponent?: string;
          date?: string;
          location?: string;
          video_id?: string;
          team_score?: number;
          opp_score?: number;
          game_type?: GameType;
          home_away?: HomeAway;
          notes?: string | null;
        };
      };
      coaching_points: {
        Row: {
          id: string;
          game_id: string;
          author_id: string;
          title: string;
          feedback: string;
          timestamp: string;
          audio_url: string | null;
          duration: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          author_id: string;
          title: string;
          feedback: string;
          timestamp: string;
          audio_url?: string | null;
          duration: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          author_id?: string;
          title?: string;
          feedback?: string;
          timestamp?: string;
          audio_url?: string | null;
          duration?: number;
          created_at?: string;
        };
      };
      coaching_point_events: {
        Row: {
          id: string;
          point_id: string;
          event_type: CoachingPointEventType;
          timestamp: number;
          event_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          point_id: string;
          event_type: CoachingPointEventType;
          timestamp: number;
          event_data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          point_id?: string;
          event_type?: CoachingPointEventType;
          timestamp?: number;
          event_data?: Json;
          created_at?: string;
        };
      };
      coaching_point_tagged_users: {
        Row: {
          id: string;
          point_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          point_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          point_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      labels: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id: string;
          name?: string;
          created_at?: string;
        };
      };
      coaching_point_labels: {
        Row: {
          id: string;
          point_id: string;
          label_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          point_id: string;
          label_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          point_id?: string;
          label_id?: string;
          created_at?: string;
        };
      };
      coaching_point_views: {
        Row: {
          id: string;
          point_id: string;
          user_id: string;
          viewed_at: string;
          acknowledged: boolean;
          ack_at: string | null;
        };
        Insert: {
          id?: string;
          point_id: string;
          user_id: string;
          viewed_at?: string;
          acknowledged?: boolean;
          ack_at?: string | null;
        };
        Update: {
          id?: string;
          point_id?: string;
          user_id?: string;
          viewed_at?: string;
          acknowledged?: boolean;
          ack_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
