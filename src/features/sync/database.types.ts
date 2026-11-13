export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      badges: {
        Row: {
          code: string
          description: string
          id: number
          name: string
          tier: string | null
          xp_reward: number
        }
        Insert: {
          code: string
          description: string
          id?: never
          name: string
          tier?: string | null
          xp_reward?: number
        }
        Update: {
          code?: string
          description?: string
          id?: never
          name?: string
          tier?: string | null
          xp_reward?: number
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          drive_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          drive_id: string
          id?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          drive_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_fingerprints: {
        Row: {
          created_at: string
          drive_id: string | null
          hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drive_id?: string | null
          hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          drive_id?: string | null
          hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_fingerprints_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_fingerprints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_private: {
        Row: {
          drive_id: string
          flags: Json
          raw_points: number | null
          top_kmh: number | null
          track_path: string | null
          user_id: string
        }
        Insert: {
          drive_id: string
          flags?: Json
          raw_points?: number | null
          top_kmh?: number | null
          track_path?: string | null
          user_id: string
        }
        Update: {
          drive_id?: string
          flags?: Json
          raw_points?: number | null
          top_kmh?: number | null
          track_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_private_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: true
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drives: {
        Row: {
          avg_moving_kmh: number | null
          avg_overall_kmh: number | null
          created_at: string
          distance_m: number | null
          elapsed_s: number | null
          ended_at: string
          id: string
          mode: string
          moving_s: number | null
          new_cells: number | null
          route: unknown
          smooth_score: number | null
          started_at: string
          status: string
          user_id: string
          vehicle_id: string | null
          visibility: string
          xp_earned: number | null
        }
        Insert: {
          avg_moving_kmh?: number | null
          avg_overall_kmh?: number | null
          created_at?: string
          distance_m?: number | null
          elapsed_s?: number | null
          ended_at: string
          id?: string
          mode?: string
          moving_s?: number | null
          new_cells?: number | null
          route?: unknown
          smooth_score?: number | null
          started_at: string
          status?: string
          user_id?: string
          vehicle_id?: string | null
          visibility?: string
          xp_earned?: number | null
        }
        Update: {
          avg_moving_kmh?: number | null
          avg_overall_kmh?: number | null
          created_at?: string
          distance_m?: number | null
          elapsed_s?: number | null
          ended_at?: string
          id?: string
          mode?: string
          moving_s?: number | null
          new_cells?: number | null
          route?: unknown
          smooth_score?: number | null
          started_at?: string
          status?: string
          user_id?: string
          vehicle_id?: string | null
          visibility?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drives_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drives_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      explored_cells: {
        Row: {
          first_drive_id: string | null
          first_seen_at: string
          h3_index: string
          user_id: string
        }
        Insert: {
          first_drive_id?: string | null
          first_seen_at?: string
          h3_index: string
          user_id: string
        }
        Update: {
          first_drive_id?: string | null
          first_seen_at?: string
          h3_index?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explored_cells_first_drive_id_fkey"
            columns: ["first_drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explored_cells_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
          status: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id?: string
          status?: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kudos: {
        Row: {
          created_at: string
          drive_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          drive_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          drive_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_zones: {
        Row: {
          center: unknown
          created_at: string
          id: string
          label: string | null
          radius_m: number
          user_id: string
        }
        Insert: {
          center: unknown
          created_at?: string
          id?: string
          label?: string | null
          radius_m?: number
          user_id?: string
        }
        Update: {
          center?: unknown
          created_at?: string
          id?: string
          label?: string | null
          radius_m?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_zones_user_id_fkey"
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
          display_name: string | null
          id: string
          is_private: boolean
          level: number
          plan: string
          province: string | null
          total_xp: number
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_private?: boolean
          level?: number
          plan?: string
          province?: string | null
          total_xp?: number
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_private?: boolean
          level?: number
          plan?: string
          province?: string | null
          total_xp?: number
          username?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: number
          drive_id: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: number
          drive_id?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: number
          drive_id?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          colour: string
          created_at: string
          id: string
          kind: string
          make: string | null
          model: string | null
          nickname: string
          user_id: string
        }
        Insert: {
          colour?: string
          created_at?: string
          id?: string
          kind?: string
          make?: string | null
          model?: string | null
          nickname: string
          user_id?: string
        }
        Update: {
          colour?: string
          created_at?: string
          id?: string
          kind?: string
          make?: string | null
          model?: string | null
          nickname?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          day: string
          drive_id: string | null
          id: number
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          day?: string
          drive_id?: string | null
          id?: never
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          day?: string
          drive_id?: string | null
          id?: never
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "drives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      drive_xp_context: {
        Args: { p_cells: string[]; p_started_at: string; p_user_id: string }
        Returns: Json
      }
      finalize_counted_drive: {
        Args: {
          p_avg_moving_kmh: number
          p_avg_overall_kmh: number
          p_cells: string[]
          p_distance_m: number
          p_drive_id: string
          p_elapsed_s: number
          p_ended_at: string
          p_fingerprint: string
          p_flags: Json
          p_moving_s: number
          p_raw_points: number
          p_route: string
          p_started_at: string
          p_top_kmh: number
          p_track_path: string
          p_user_id: string
          p_xp_distance: number
          p_xp_first_drive: number
          p_xp_per_new_cell: number
        }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
