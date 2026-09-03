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
      alarm_sessions: {
        Row: {
          alarm_id: string
          coins_awarded: number
          completed_on: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          alarm_id: string
          coins_awarded?: number
          completed_on?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alarm_id?: string
          coins_awarded?: number
          completed_on?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alarm_sessions_alarm_id_fkey"
            columns: ["alarm_id"]
            isOneToOne: false
            referencedRelation: "alarms"
            referencedColumns: ["id"]
          },
        ]
      }
      alarms: {
        Row: {
          challenge_type: string
          created_at: string
          days: number[]
          id: string
          is_active: boolean
          label: string | null
          time: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          days?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          time: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          days?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          time?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_trials: {
        Row: {
          created_at: string
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          amount: number
          created_at: string
          currency: string
          environment: string
          id: string
          period: string
          plan_id: string
          price_key: string
          provider: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          environment: string
          id?: string
          period: string
          plan_id: string
          price_key: string
          provider?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          period?: string
          plan_id?: string
          price_key?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          blocked_apps: string[]
          coins_awarded: number
          created_at: string
          id: string
          lock_mode: string
          minutes: number
          tier: string
          user_id: string
        }
        Insert: {
          blocked_apps?: string[]
          coins_awarded?: number
          created_at?: string
          id?: string
          lock_mode?: string
          minutes: number
          tier: string
          user_id: string
        }
        Update: {
          blocked_apps?: string[]
          coins_awarded?: number
          created_at?: string
          id?: string
          lock_mode?: string
          minutes?: number
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_reminders: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          remind_at: string
          task_id: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          remind_at?: string
          task_id: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          remind_at?: string
          task_id?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          environment: string
          event_type: string
          id: string
          provider_event_id: string
          raw: Json | null
          status: string | null
          subscription_id: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          environment: string
          event_type: string
          id?: string
          provider_event_id: string
          raw?: Json | null
          status?: string | null
          subscription_id?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          event_type?: string
          id?: string
          provider_event_id?: string
          raw?: Json | null
          status?: string | null
          subscription_id?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acquisition_source: string | null
          active_subscription_id: string | null
          avatar_url: string | null
          bio: string | null
          coins: number
          created_at: string
          display_name: string | null
          gym_lat: number | null
          gym_lng: number | null
          gym_radius_m: number
          id: string
          is_subscribed: boolean
          last_activity_date: string | null
          last_penalty_date: string | null
          longest_streak: number
          onboarded: boolean
          onboarding_answered_at: string | null
          onboarding_blocker: string | null
          onboarding_goal: string | null
          onboarding_habit_count: number | null
          referral_code: string | null
          referred_by: string | null
          shields: number
          streak: number
          subscription_platform: string | null
          trial_ends_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          acquisition_source?: string | null
          active_subscription_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          gym_lat?: number | null
          gym_lng?: number | null
          gym_radius_m?: number
          id: string
          is_subscribed?: boolean
          last_activity_date?: string | null
          last_penalty_date?: string | null
          longest_streak?: number
          onboarded?: boolean
          onboarding_answered_at?: string | null
          onboarding_blocker?: string | null
          onboarding_goal?: string | null
          onboarding_habit_count?: number | null
          referral_code?: string | null
          referred_by?: string | null
          shields?: number
          streak?: number
          subscription_platform?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          acquisition_source?: string | null
          active_subscription_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          gym_lat?: number | null
          gym_lng?: number | null
          gym_radius_m?: number
          id?: string
          is_subscribed?: boolean
          last_activity_date?: string | null
          last_penalty_date?: string | null
          longest_streak?: number
          onboarded?: boolean
          onboarding_answered_at?: string | null
          onboarding_blocker?: string | null
          onboarding_goal?: string | null
          onboarding_habit_count?: number | null
          referral_code?: string | null
          referred_by?: string | null
          shields?: number
          streak?: number
          subscription_platform?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      streak_shield_uses: {
        Row: {
          created_at: string
          id: string
          used_for: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          used_for: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          used_for?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string | null
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string
          short_url: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id: string
          short_url?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string
          short_url?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          coins_awarded: number
          completed_on: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          coins_awarded?: number
          completed_on?: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          coins_awarded?: number
          completed_on?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          pts: number
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          pts?: number
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          pts?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          coins: number | null
          display_name: string | null
          id: string | null
          longest_streak: number | null
          streak: number | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          coins?: number | null
          display_name?: string | null
          id?: string | null
          longest_streak?: number | null
          streak?: number | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          coins?: number | null
          display_name?: string | null
          id?: string | null
          longest_streak?: number | null
          streak?: number | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_daily_penalty: {
        Args: never
        Returns: {
          coins: number
          penalized: boolean
        }[]
      }
      buy_streak_shield: {
        Args: never
        Returns: {
          coins: number
          shields: number
        }[]
      }
      complete_alarm: {
        Args: { _alarm_id: string; _reward?: number }
        Returns: {
          awarded: number
          coins: number
        }[]
      }
      complete_focus_session: {
        Args: { _blocked_apps?: string[]; _lock_mode?: string; _tier: string }
        Returns: {
          awarded: number
          coins: number
          minutes: number
        }[]
      }
      complete_task: {
        Args: { _task_id: string }
        Returns: {
          awarded: number
          coins: number
          longest_streak: number
          streak: number
        }[]
      }
      ensure_app_trial: {
        Args: never
        Returns: {
          trial_ends_at: string
          trial_started_at: string
        }[]
      }
      get_or_create_referral_code: { Args: never; Returns: string }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_premium_access: { Args: { _user_id?: string }; Returns: boolean }
      list_friends: {
        Args: never
        Returns: {
          avatar_url: string
          coins: number
          direction: string
          display_name: string
          friend_id: string
          friendship_id: string
          longest_streak: number
          status: string
          streak: number
          username: string
        }[]
      }
      redeem_referral_code: {
        Args: { _code: string }
        Returns: {
          applied: boolean
          coins: number
          reason: string
        }[]
      }
      respond_friend_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      send_friend_request: {
        Args: { _username: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      use_streak_shield: {
        Args: never
        Returns: {
          applied: boolean
          reason: string
          shields: number
        }[]
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
  public: {
    Enums: {},
  },
} as const
