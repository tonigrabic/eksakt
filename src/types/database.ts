export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      competitions: {
        Row: {
          api_external_id: number | null
          code: string
          created_at: string
          emblem_url: string | null
          id: string
          name: string
          season_end: string
          season_start: string
          type: string
        }
        Insert: {
          api_external_id?: number | null
          code: string
          created_at?: string
          emblem_url?: string | null
          id?: string
          name: string
          season_end: string
          season_start: string
          type: string
        }
        Update: {
          api_external_id?: number | null
          code?: string
          created_at?: string
          emblem_url?: string | null
          id?: string
          name?: string
          season_end?: string
          season_start?: string
          type?: string
        }
        Relationships: []
      }
      league_competitions: {
        Row: {
          added_at: string
          added_by: string | null
          competition_id: string
          id: string
          league_id: string
          start_date: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          competition_id: string
          id?: string
          league_id: string
          start_date?: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          competition_id?: string
          id?: string
          league_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_competitions_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_competitions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_competitions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_matches: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          league_id: string
          match_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          league_id: string
          match_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          league_id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_matches_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          invite_code: string
          name: string
          settings: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          invite_code: string
          name: string
          settings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          invite_code?: string
          name?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_external_id: number | null
          away_score: number | null
          away_team_id: string | null
          competition_id: string
          created_at: string
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_time: string
          live_minute: string | null
          matchday: number | null
          round_id: string
          status: string
          updated_at: string
        }
        Insert: {
          api_external_id?: number | null
          away_score?: number | null
          away_team_id?: string | null
          competition_id: string
          created_at?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_time: string
          live_minute?: string | null
          matchday?: number | null
          round_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          api_external_id?: number | null
          away_score?: number | null
          away_team_id?: string | null
          competition_id?: string
          created_at?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_time?: string
          live_minute?: string | null
          matchday?: number | null
          round_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      points: {
        Row: {
          base_points: number
          booster_multiplier: number
          created_at: string
          exact_bonus: number
          exact_pct: number
          id: string
          member_count: number
          outcome_bonus: number
          outcome_pct: number
          prediction_id: string
          same_exact_count: number
          same_outcome_count: number
          total: number
        }
        Insert: {
          base_points: number
          booster_multiplier: number
          created_at?: string
          exact_bonus: number
          exact_pct?: number
          id?: string
          member_count?: number
          outcome_bonus: number
          outcome_pct?: number
          prediction_id: string
          same_exact_count?: number
          same_outcome_count?: number
          total: number
        }
        Update: {
          base_points?: number
          booster_multiplier?: number
          created_at?: string
          exact_bonus?: number
          exact_pct?: number
          id?: string
          member_count?: number
          outcome_bonus?: number
          outcome_pct?: number
          prediction_id?: string
          same_exact_count?: number
          same_outcome_count?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "points_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: true
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_score: number
          booster: string | null
          created_at: string
          home_score: number
          id: string
          league_id: string
          match_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          booster?: string | null
          created_at?: string
          home_score: number
          id?: string
          league_id: string
          match_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          booster?: string | null
          created_at?: string
          home_score?: number
          id?: string
          league_id?: string
          match_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          api_external_id: number | null
          country_code: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          short_name: string
        }
        Insert: {
          api_external_id?: number | null
          country_code: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          short_name: string
        }
        Update: {
          api_external_id?: number | null
          country_code?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _eksakt_secret: { Args: { p_name: string }; Returns: string }
      booster_multiplier: { Args: { p_booster: string }; Returns: number }
      compute_points_for_match: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      dispatch_edge_function: {
        Args: { p_body: Json; p_function_name: string }
        Returns: number
      }
      dispatch_sync_fixtures: { Args: { p_code: string }; Returns: number }
      dispatch_sync_live_matches: { Args: { p_code: string }; Returns: number }
      get_league_matches: {
        Args: { p_league_id: string }
        Returns: {
          api_external_id: number | null
          away_score: number | null
          away_team_id: string | null
          competition_id: string
          created_at: string
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_time: string
          live_minute: string | null
          matchday: number | null
          round_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_league_member: { Args: { p_league_id: string }; Returns: boolean }
      join_league_by_code: { Args: { p_code: string }; Returns: string }
      league_match_ids: {
        Args: { p_league_id: string }
        Returns: {
          match_id: string
        }[]
      }
      match_has_kicked_off: { Args: { p_match_id: string }; Returns: boolean }
      rarity_bonus: {
        Args: { p_matching_count: number; p_total_count: number }
        Returns: number
      }
      should_poll_live_matches: {
        Args: { p_competition_code: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

