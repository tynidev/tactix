// Copy of backend database types for frontend use
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined; }
  | Json[];

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
          coach_join_code: string;
          player_join_code: string;
          admin_join_code: string;
          parent_join_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          coach_join_code?: string;
          player_join_code?: string;
          admin_join_code?: string;
          parent_join_code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          coach_join_code?: string;
          player_join_code?: string;
          admin_join_code?: string;
          parent_join_code?: string;
          created_at?: string;
        };
      };
      team_memberships: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: 'coach' | 'player' | 'admin' | 'parent';
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role: 'coach' | 'player' | 'admin' | 'parent';
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: 'coach' | 'player' | 'admin' | 'parent';
        };
      };
      // ... other tables would be here, truncated for brevity
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
