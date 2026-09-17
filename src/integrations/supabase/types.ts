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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_vectors: {
        Row: {
          couple_id: string
          d1_max: number | null
          d1_min: number | null
          d10_max: number | null
          d10_min: number | null
          d2_max: number | null
          d2_min: number | null
          d3_max: number | null
          d3_min: number | null
          d4_max: number | null
          d4_min: number | null
          d5_max: number | null
          d5_min: number | null
          d6_max: number | null
          d6_min: number | null
          d7_max: number | null
          d7_min: number | null
          d8_max: number | null
          d8_min: number | null
          d9_max: number | null
          d9_min: number | null
          id: string
          updated_at: string
        }
        Insert: {
          couple_id: string
          d1_max?: number | null
          d1_min?: number | null
          d10_max?: number | null
          d10_min?: number | null
          d2_max?: number | null
          d2_min?: number | null
          d3_max?: number | null
          d3_min?: number | null
          d4_max?: number | null
          d4_min?: number | null
          d5_max?: number | null
          d5_min?: number | null
          d6_max?: number | null
          d6_min?: number | null
          d7_max?: number | null
          d7_min?: number | null
          d8_max?: number | null
          d8_min?: number | null
          d9_max?: number | null
          d9_min?: number | null
          id?: string
          updated_at?: string
        }
        Update: {
          couple_id?: string
          d1_max?: number | null
          d1_min?: number | null
          d10_max?: number | null
          d10_min?: number | null
          d2_max?: number | null
          d2_min?: number | null
          d3_max?: number | null
          d3_min?: number | null
          d4_max?: number | null
          d4_min?: number | null
          d5_max?: number | null
          d5_min?: number | null
          d6_max?: number | null
          d6_min?: number | null
          d7_max?: number | null
          d7_min?: number | null
          d8_max?: number | null
          d8_min?: number | null
          d9_max?: number | null
          d9_min?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_vectors_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: true
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          both_verified: boolean | null
          created_at: string
          id: string
          invite_code: string
          partner_a_id: string
          partner_b_id: string | null
        }
        Insert: {
          both_verified?: boolean | null
          created_at?: string
          id?: string
          invite_code: string
          partner_a_id: string
          partner_b_id?: string | null
        }
        Update: {
          both_verified?: boolean | null
          created_at?: string
          id?: string
          invite_code?: string
          partner_a_id?: string
          partner_b_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couples_partner_a_id_fkey"
            columns: ["partner_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couples_partner_b_id_fkey"
            columns: ["partner_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_candidate_notices: {
        Row: {
          candidate_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          candidate_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          candidate_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_candidate_notices_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_candidate_notices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          compatibility_score: number
          created_at: string
          id: string
          revealed_at: string | null
          status: string
          user_a_action: string | null
          user_a_id: string
          user_b_action: string | null
          user_b_id: string
        }
        Insert: {
          compatibility_score: number
          created_at?: string
          id?: string
          revealed_at?: string | null
          status?: string
          user_a_action?: string | null
          user_a_id: string
          user_b_action?: string | null
          user_b_id: string
        }
        Update: {
          compatibility_score?: number
          created_at?: string
          id?: string
          revealed_at?: string | null
          status?: string
          user_a_action?: string | null
          user_a_id?: string
          user_b_action?: string | null
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          match_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          match_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          match_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_group: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          first_name: string | null
          gender: string | null
          id: string
          is_suspended: boolean
          last_active: string
          location_city: string | null
          looking_for: string[] | null
          matching_paused: boolean
          onboarding_completed: boolean
          privacy_consented: boolean
          quality_score: number
          quiz_completed: boolean
          referral_code: string | null
          referred_by: string | null
          social_link: string | null
          suspended_at: string | null
          suspension_reason: string | null
          travel_radius_km: number | null
          user_type: string | null
        }
        Insert: {
          age_group?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          gender?: string | null
          id: string
          is_suspended?: boolean
          last_active?: string
          location_city?: string | null
          looking_for?: string[] | null
          matching_paused?: boolean
          onboarding_completed?: boolean
          privacy_consented?: boolean
          quality_score?: number
          quiz_completed?: boolean
          referral_code?: string | null
          referred_by?: string | null
          social_link?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          travel_radius_km?: number | null
          user_type?: string | null
        }
        Update: {
          age_group?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          gender?: string | null
          id?: string
          is_suspended?: boolean
          last_active?: string
          location_city?: string | null
          looking_for?: string[] | null
          matching_paused?: boolean
          onboarding_completed?: boolean
          privacy_consented?: boolean
          quality_score?: number
          quiz_completed?: boolean
          referral_code?: string | null
          referred_by?: string | null
          social_link?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          travel_radius_km?: number | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_feedback: {
        Row: {
          activities: string[] | null
          activity_other: string | null
          created_at: string
          id: string
          match_id: string
          met_in_person: string
          rating: number | null
          user_id: string
          want_more_matches: boolean
        }
        Insert: {
          activities?: string[] | null
          activity_other?: string | null
          created_at?: string
          id?: string
          match_id: string
          met_in_person: string
          rating?: number | null
          user_id: string
          want_more_matches: boolean
        }
        Update: {
          activities?: string[] | null
          activity_other?: string | null
          created_at?: string
          id?: string
          match_id?: string
          met_in_person?: string
          rating?: number | null
          user_id?: string
          want_more_matches?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pulse_feedback_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_responses: {
        Row: {
          couple_id: string | null
          created_at: string
          dimension_1_social: number
          dimension_10_home: number
          dimension_2_budget: number
          dimension_3_spontaneity: number
          dimension_4_planning: number
          dimension_5_intellectual: number
          dimension_6_activity: number
          dimension_7_alcohol: number
          dimension_8_humor: number
          dimension_9_commitment: number
          id: string
          user_id: string
        }
        Insert: {
          couple_id?: string | null
          created_at?: string
          dimension_1_social: number
          dimension_10_home: number
          dimension_2_budget: number
          dimension_3_spontaneity: number
          dimension_4_planning: number
          dimension_5_intellectual: number
          dimension_6_activity: number
          dimension_7_alcohol: number
          dimension_8_humor: number
          dimension_9_commitment: number
          id?: string
          user_id: string
        }
        Update: {
          couple_id?: string | null
          created_at?: string
          dimension_1_social?: number
          dimension_10_home?: number
          dimension_2_budget?: number
          dimension_3_spontaneity?: number
          dimension_4_planning?: number
          dimension_5_intellectual?: number
          dimension_6_activity?: number
          dimension_7_alcohol?: number
          dimension_8_humor?: number
          dimension_9_commitment?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          priority_boost_expiry: string | null
          referral_code: string
          referrer_id: string
          successful_signups: number
        }
        Insert: {
          created_at?: string
          id?: string
          priority_boost_expiry?: string | null
          referral_code: string
          referrer_id: string
          successful_signups?: number
        }
        Update: {
          created_at?: string
          id?: string
          priority_boost_expiry?: string | null
          referral_code?: string
          referrer_id?: string
          successful_signups?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          match_id: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          match_id?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          match_id?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
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
      block_match_user: {
        Args: { _match_id: string; _other_user_id: string }
        Returns: undefined
      }
      get_couple_partner_id: { Args: never; Returns: string }
      handle_match_action: {
        Args: { _action: string; _other_user_id: string }
        Returns: Json
      }
      is_couple_member: { Args: { _couple_id: string }; Returns: boolean }
      is_match_participant: { Args: { _match_id: string }; Returns: boolean }
      is_match_viewer: { Args: { _match_id: string }; Returns: boolean }
      lookup_referral_code: { Args: { _code: string }; Returns: Json }
      process_referral: {
        Args: { _new_user_id: string; _referral_code: string }
        Returns: undefined
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
