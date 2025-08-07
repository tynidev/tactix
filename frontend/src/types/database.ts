export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined; }
  | Json[];

export type Database = {
  public: {
    Tables: {
      coaching_point_events: {
        Row: {
          created_at: string | null;
          event_data: Json | null;
          event_type: Database['public']['Enums']['event_type'];
          id: string;
          point_id: string;
          timestamp: number;
        };
        Insert: {
          created_at?: string | null;
          event_data?: Json | null;
          event_type: Database['public']['Enums']['event_type'];
          id?: string;
          point_id: string;
          timestamp: number;
        };
        Update: {
          created_at?: string | null;
          event_data?: Json | null;
          event_type?: Database['public']['Enums']['event_type'];
          id?: string;
          point_id?: string;
          timestamp?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'coaching_point_events_point_id_fkey';
            columns: ['point_id'];
            isOneToOne: false;
            referencedRelation: 'coaching_points';
            referencedColumns: ['id'];
          },
        ];
      };
      coaching_point_labels: {
        Row: {
          created_at: string | null;
          id: string;
          label_id: string;
          point_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          label_id: string;
          point_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          label_id?: string;
          point_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coaching_point_labels_label_id_fkey';
            columns: ['label_id'];
            isOneToOne: false;
            referencedRelation: 'labels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coaching_point_labels_point_id_fkey';
            columns: ['point_id'];
            isOneToOne: false;
            referencedRelation: 'coaching_points';
            referencedColumns: ['id'];
          },
        ];
      };
      coaching_point_tagged_players: {
        Row: {
          created_at: string | null;
          id: string;
          player_id: string;
          point_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          player_id: string;
          point_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          player_id?: string;
          point_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coaching_point_tagged_players_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'player_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coaching_point_tagged_players_point_id_fkey';
            columns: ['point_id'];
            isOneToOne: false;
            referencedRelation: 'coaching_points';
            referencedColumns: ['id'];
          },
        ];
      };
      coaching_point_views: {
        Row: {
          ack_at: string | null;
          acknowledged: boolean | null;
          id: string;
          player_id: string;
          point_id: string;
          viewed_at: string | null;
        };
        Insert: {
          ack_at?: string | null;
          acknowledged?: boolean | null;
          id?: string;
          player_id: string;
          point_id: string;
          viewed_at?: string | null;
        };
        Update: {
          ack_at?: string | null;
          acknowledged?: boolean | null;
          id?: string;
          player_id?: string;
          point_id?: string;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'coaching_point_views_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'player_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coaching_point_views_point_id_fkey';
            columns: ['point_id'];
            isOneToOne: false;
            referencedRelation: 'coaching_points';
            referencedColumns: ['id'];
          },
        ];
      };
      coaching_points: {
        Row: {
          audio_url: string | null;
          author_id: string;
          created_at: string | null;
          duration: number | null;
          feedback: string | null;
          game_id: string;
          id: string;
          timestamp: string | null;
          title: string;
        };
        Insert: {
          audio_url?: string | null;
          author_id: string;
          created_at?: string | null;
          duration?: number | null;
          feedback?: string | null;
          game_id: string;
          id?: string;
          timestamp?: string | null;
          title: string;
        };
        Update: {
          audio_url?: string | null;
          author_id?: string;
          created_at?: string | null;
          duration?: number | null;
          feedback?: string | null;
          game_id?: string;
          id?: string;
          timestamp?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coaching_points_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coaching_points_game_id_fkey';
            columns: ['game_id'];
            isOneToOne: false;
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
      games: {
        Row: {
          created_at: string | null;
          date: string;
          game_type: Database['public']['Enums']['game_type'] | null;
          home_away: Database['public']['Enums']['home_away'] | null;
          id: string;
          location: string | null;
          notes: string | null;
          opp_score: number | null;
          opponent: string;
          team_id: string;
          team_score: number | null;
          video_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          date: string;
          game_type?: Database['public']['Enums']['game_type'] | null;
          home_away?: Database['public']['Enums']['home_away'] | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          opp_score?: number | null;
          opponent: string;
          team_id: string;
          team_score?: number | null;
          video_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          date?: string;
          game_type?: Database['public']['Enums']['game_type'] | null;
          home_away?: Database['public']['Enums']['home_away'] | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          opp_score?: number | null;
          opponent?: string;
          team_id?: string;
          team_score?: number | null;
          video_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'games_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      guardian_player_relationships: {
        Row: {
          created_at: string | null;
          guardian_id: string;
          id: string;
          player_profile_id: string;
          player_user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          guardian_id: string;
          id?: string;
          player_profile_id: string;
          player_user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          guardian_id?: string;
          id?: string;
          player_profile_id?: string;
          player_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'guardian_player_relationships_guardian_id_fkey';
            columns: ['guardian_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guardian_player_relationships_player_profile_id_fkey';
            columns: ['player_profile_id'];
            isOneToOne: false;
            referencedRelation: 'player_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guardian_player_relationships_player_user_id_fkey';
            columns: ['player_user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      labels: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          team_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          team_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'labels_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      player_profiles: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'player_profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      team_join_codes: {
        Row: {
          code: string;
          created_at: string | null;
          created_by: string;
          expires_at: string | null;
          id: string;
          is_active: boolean | null;
          team_id: string;
          team_role: Database['public']['Enums']['team_role'] | null;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          team_id: string;
          team_role?: Database['public']['Enums']['team_role'] | null;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          team_id?: string;
          team_role?: Database['public']['Enums']['team_role'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'team_join_codes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_join_codes_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      team_memberships: {
        Row: {
          created_at: string | null;
          id: string;
          role: Database['public']['Enums']['team_role'];
          team_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          role: Database['public']['Enums']['team_role'];
          team_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          role?: Database['public']['Enums']['team_role'];
          team_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_memberships_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      team_players: {
        Row: {
          created_at: string | null;
          id: string;
          jersey_number: string | null;
          player_id: string;
          team_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          jersey_number?: string | null;
          player_id: string;
          team_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          jersey_number?: string | null;
          player_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_players_player_id_fkey';
            columns: ['player_id'];
            isOneToOne: false;
            referencedRelation: 'player_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_players_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_sample_data: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      create_team_with_creator: {
        Args: { team_name: string; creator_id?: string; };
        Returns: Json;
      };
      generate_join_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_team_members_with_players: {
        Args: { team_id_param: string; };
        Returns: {
          user_id: string;
          user_name: string;
          user_email: string;
          user_role: Database['public']['Enums']['team_role'];
          player_profile_id: string;
          player_name: string;
          jersey_number: string;
        }[];
      };
      get_user_teams: {
        Args: { user_id_param?: string; };
        Returns: {
          team_id: string;
          team_name: string;
          user_role: Database['public']['Enums']['team_role'];
          created_at: string;
          member_count: number;
        }[];
      };
      join_team_transaction: {
        Args: {
          p_user_id: string;
          p_team_id: string;
          p_role: string;
          p_player_data?: Json;
          p_user_name?: string;
        };
        Returns: Json;
      };
      join_team_with_code: {
        Args: { join_code: string; user_id_param?: string; };
        Returns: Json;
      };
    };
    Enums: {
      event_type: 'play' | 'pause' | 'seek' | 'draw' | 'change_speed' | 'recording_start';
      game_type: 'regular' | 'tournament' | 'scrimmage';
      home_away: 'home' | 'away' | 'neutral';
      team_role: 'coach' | 'player' | 'admin' | 'guardian';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database; },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof (
      & Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
      & Database[DefaultSchemaTableNameOrOptions['schema']]['Views']
    ) :
    never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database; } ? (
    & Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    & Database[DefaultSchemaTableNameOrOptions['schema']]['Views']
  )[TableName] extends {
    Row: infer R;
  } ? R :
  never :
  DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema['Tables']
    & DefaultSchema['Views']
  ) ? (
      & DefaultSchema['Tables']
      & DefaultSchema['Views']
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R :
    never :
  never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database; },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] :
    never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database; } ?
  Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Insert: infer I;
  } ? I :
  never :
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] ?
    DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I :
    never :
  never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database; },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] :
    never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database; } ?
  Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Update: infer U;
  } ? U :
  never :
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] ?
    DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U :
    never :
  never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database; },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'] :
    never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database; } ?
  Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName] :
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] ?
    DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions] :
  never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database; },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  } ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'] :
    never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database; } ?
  Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName] :
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes'] ?
    DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions] :
  never;

export enum TeamRole
{
  Coach = 'coach',
  Player = 'player',
  Admin = 'admin',
  Guardian = 'guardian',
}
export enum EventType
{
  Play = 'play',
  Pause = 'pause',
  Seek = 'seek',
  Draw = 'draw',
  ChangeSpeed = 'change_speed',
  RecordingStart = 'recording_start',
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
