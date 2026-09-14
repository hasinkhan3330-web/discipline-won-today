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
      accountability_pacts: {
        Row: {
          created_at: string
          daily_target: number
          id: string
          owner_id: string
          partner_id: string
          stake_coins: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_target?: number
          id?: string
          owner_id: string
          partner_id: string
          stake_coins?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_target?: number
          id?: string
          owner_id?: string
          partner_id?: string
          stake_coins?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      alarm_sessions: {
        Row: {
          alarm_id: string
          attempts: number
          checked_in_at: string | null
          coins_awarded: number
          completed_on: string
          created_at: string
          id: string
          recovered: boolean
          status: string
          user_id: string
        }
        Insert: {
          alarm_id: string
          attempts?: number
          checked_in_at?: string | null
          coins_awarded?: number
          completed_on?: string
          created_at?: string
          id?: string
          recovered?: boolean
          status?: string
          user_id: string
        }
        Update: {
          alarm_id?: string
          attempts?: number
          checked_in_at?: string | null
          coins_awarded?: number
          completed_on?: string
          created_at?: string
          id?: string
          recovered?: boolean
          status?: string
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
          challenge_started_on: string | null
          challenge_type: string
          checkin_window_minutes: number
          created_at: string
          days: number[]
          id: string
          is_active: boolean
          label: string | null
          recovery_enabled: boolean
          sleep_recommendation: string | null
          time: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_started_on?: string | null
          challenge_type?: string
          checkin_window_minutes?: number
          created_at?: string
          days?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          recovery_enabled?: boolean
          sleep_recommendation?: string | null
          time: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_started_on?: string | null
          challenge_type?: string
          checkin_window_minutes?: number
          created_at?: string
          days?: number[]
          id?: string
          is_active?: boolean
          label?: string | null
          recovery_enabled?: boolean
          sleep_recommendation?: string | null
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
      billing_notifications: {
        Row: {
          event_id: string
          event_type: string | null
          id: string
          processed_at: string
          provider: string
          user_id: string | null
        }
        Insert: {
          event_id: string
          event_type?: string | null
          id?: string
          processed_at?: string
          provider?: string
          user_id?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string | null
          id?: string
          processed_at?: string
          provider?: string
          user_id?: string | null
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
      coach_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          suggested_action: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          suggested_action?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          suggested_action?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "coach_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          consistency_score: number
          created_at: string
          id: string
          note_date: string
          recommended_focus: string | null
          summary_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consistency_score?: number
          created_at?: string
          id?: string
          note_date?: string
          recommended_focus?: string | null
          summary_text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consistency_score?: number
          created_at?: string
          id?: string
          note_date?: string
          recommended_focus?: string | null
          summary_text?: string
          updated_at?: string
          user_id?: string
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
      entitlements: {
        Row: {
          product_id: string | null
          purchase_token_hash: string | null
          subscription_expires_at: string | null
          subscription_status: string
          trial_claimed: boolean
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          product_id?: string | null
          purchase_token_hash?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string
          trial_claimed?: boolean
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          product_id?: string | null
          purchase_token_hash?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string
          trial_claimed?: boolean
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          blocked_apps: string[]
          coins_awarded: number
          created_at: string
          ended_at: string | null
          id: string
          intensity: string | null
          lock_mode: string
          minutes: number
          session_token: string | null
          started_at: string | null
          tier: string
          user_id: string
        }
        Insert: {
          blocked_apps?: string[]
          coins_awarded?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          intensity?: string | null
          lock_mode?: string
          minutes: number
          session_token?: string | null
          started_at?: string | null
          tier: string
          user_id: string
        }
        Update: {
          blocked_apps?: string[]
          coins_awarded?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          intensity?: string | null
          lock_mode?: string
          minutes?: number
          session_token?: string | null
          started_at?: string | null
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
      goals: {
        Row: {
          completed: boolean
          created_at: string
          description: string | null
          id: string
          progress: number
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_reminders: {
        Row: {
          created_at: string
          enabled: boolean
          goal_id: string | null
          id: string
          last_scheduled_at: string | null
          notification_id: number | null
          remind_at: string
          repeat_mode: string
          scheduling_error: string | null
          scheduling_status: string
          snooze_minutes: number
          sound: string
          task_id: string | null
          timezone: string
          title: string | null
          updated_at: string
          user_id: string
          vibration: boolean
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          goal_id?: string | null
          id?: string
          last_scheduled_at?: string | null
          notification_id?: number | null
          remind_at?: string
          repeat_mode?: string
          scheduling_error?: string | null
          scheduling_status?: string
          snooze_minutes?: number
          sound?: string
          task_id?: string | null
          timezone?: string
          title?: string | null
          updated_at?: string
          user_id: string
          vibration?: boolean
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          goal_id?: string | null
          id?: string
          last_scheduled_at?: string | null
          notification_id?: number | null
          remind_at?: string
          repeat_mode?: string
          scheduling_error?: string | null
          scheduling_status?: string
          snooze_minutes?: number
          sound?: string
          task_id?: string | null
          timezone?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          vibration?: boolean
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "habit_reminders_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pact_nudges: {
        Row: {
          created_at: string
          from_user: string
          id: string
          message: string
          pact_id: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          message: string
          pact_id: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          message?: string
          pact_id?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "pact_nudges_pact_id_fkey"
            columns: ["pact_id"]
            isOneToOne: false
            referencedRelation: "accountability_pacts"
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
          age_range: string | null
          avatar_url: string | null
          behavioral_tracking_allowed: boolean
          biggest_distraction: string | null
          bio: string | null
          coins: number
          commitment_milestone: number | null
          consistency_days: number | null
          country: string
          created_at: string
          display_name: string | null
          first_habit: string | null
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
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_goal: string | null
          onboarding_habit_count: number | null
          onboarding_step: number
          onboarding_version: number
          preferred_focus_time: string | null
          preferred_name: string | null
          primary_goal: string | null
          referral_code: string | null
          referred_by: string | null
          routine_breaker: string | null
          safe_minor_mode: boolean
          shields: number
          sleep_time: string | null
          social_hours_daily: number | null
          streak: number
          subscription_platform: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          username: string | null
          wake_time: string | null
        }
        Insert: {
          acquisition_source?: string | null
          active_subscription_id?: string | null
          age_range?: string | null
          avatar_url?: string | null
          behavioral_tracking_allowed?: boolean
          biggest_distraction?: string | null
          bio?: string | null
          coins?: number
          commitment_milestone?: number | null
          consistency_days?: number | null
          country?: string
          created_at?: string
          display_name?: string | null
          first_habit?: string | null
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
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_goal?: string | null
          onboarding_habit_count?: number | null
          onboarding_step?: number
          onboarding_version?: number
          preferred_focus_time?: string | null
          preferred_name?: string | null
          primary_goal?: string | null
          referral_code?: string | null
          referred_by?: string | null
          routine_breaker?: string | null
          safe_minor_mode?: boolean
          shields?: number
          sleep_time?: string | null
          social_hours_daily?: number | null
          streak?: number
          subscription_platform?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          username?: string | null
          wake_time?: string | null
        }
        Update: {
          acquisition_source?: string | null
          active_subscription_id?: string | null
          age_range?: string | null
          avatar_url?: string | null
          behavioral_tracking_allowed?: boolean
          biggest_distraction?: string | null
          bio?: string | null
          coins?: number
          commitment_milestone?: number | null
          consistency_days?: number | null
          country?: string
          created_at?: string
          display_name?: string | null
          first_habit?: string | null
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
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_goal?: string | null
          onboarding_habit_count?: number | null
          onboarding_step?: number
          onboarding_version?: number
          preferred_focus_time?: string | null
          preferred_name?: string | null
          primary_goal?: string | null
          referral_code?: string | null
          referred_by?: string | null
          routine_breaker?: string | null
          safe_minor_mode?: boolean
          shields?: number
          sleep_time?: string | null
          social_hours_daily?: number | null
          streak?: number
          subscription_platform?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          username?: string | null
          wake_time?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          alarm_id: string | null
          answer_given: string | null
          correct: boolean
          created_at: string
          id: string
          question_id: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          alarm_id?: string | null
          answer_given?: string | null
          correct?: boolean
          created_at?: string
          id?: string
          question_id?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          alarm_id?: string | null
          answer_given?: string | null
          correct?: boolean
          created_at?: string
          id?: string
          question_id?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          is_active: boolean
          options: Json | null
          question_text: string
          subject: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json | null
          question_text: string
          subject: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json | null
          question_text?: string
          subject?: string
        }
        Relationships: []
      }
      score_events: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          occurred_at: string
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          occurred_at?: string
          points: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          occurred_at?: string
          points?: number
          user_id?: string
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
          duration_days: number
          frequency: string
          icon: string
          id: string
          is_active: boolean
          name: string
          pts: number
          sort_order: number
          started_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_days?: number
          frequency?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          pts?: number
          sort_order?: number
          started_on?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          frequency?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          pts?: number
          sort_order?: number
          started_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      unlock_rewards: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          reward_key: string
          unlocked_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          reward_key: string
          unlocked_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          reward_key?: string
          unlocked_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vision_verifications: {
        Row: {
          created_at: string
          detections: Json
          id: string
          kind: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detections?: Json
          id?: string
          kind: string
          source?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          detections?: Json
          id?: string
          kind?: string
          source?: string
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
      activate_axen_plan: { Args: { _answers: Json }; Returns: undefined }
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
      complete_focus_music_session: {
        Args: { _intensity: string; _minutes: number; _session_token: string }
        Returns: {
          awarded: number
          coins: number
          minutes: number
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
      complete_wake_protocol: {
        Args: { _slot: string; _task_id?: string }
        Returns: {
          awarded: number
          coins: number
          longest_streak: number
          streak: number
        }[]
      }
      complete_zen_session: {
        Args: { _minutes: number }
        Returns: {
          awarded: number
          coins: number
          minutes: number
        }[]
      }
      ensure_app_trial: {
        Args: never
        Returns: {
          trial_ends_at: string
          trial_started_at: string
        }[]
      }
      get_entitlement: {
        Args: never
        Returns: {
          access_status: string
          current_period_end: string
          is_premium: boolean
          plan: string
          premium_access: boolean
          remaining_seconds: number
          server_now: string
          subscription_provider: string
          subscription_status: string
          trial_day: number
          trial_ends_at: string
          trial_started_at: string
        }[]
      }
      get_or_create_referral_code: { Args: never; Returns: string }
      get_pact_status: {
        Args: never
        Returns: {
          daily_target: number
          last_nudge: string
          last_nudge_at: string
          me_done_today: number
          me_streak: number
          me_total_today: number
          pact_id: string
          partner_avatar: string
          partner_done_today: number
          partner_id: string
          partner_name: string
          partner_streak: number
          partner_total_today: number
          role: string
          stake_coins: number
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_premium_access: { Args: { _user_id?: string }; Returns: boolean }
      initialize_trial: {
        Args: never
        Returns: {
          trial_claimed: boolean
          trial_ends_at: string
          trial_started_at: string
        }[]
      }
      leaderboard_scores: {
        Args: { _period: string }
        Returns: {
          points: number
          reached_at: string
          user_id: string
        }[]
      }
      leaderboard_top: {
        Args: {
          _limit?: number
          _offset?: number
          _period?: string
          _scope?: string
        }
        Returns: {
          avatar_url: string
          consistency: number
          country: string
          elite: boolean
          is_me: boolean
          points: number
          rank: number
          user_id: string
          username: string
        }[]
      }
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
      my_leaderboard_position: {
        Args: { _period?: string; _scope?: string }
        Returns: {
          consistency: number
          country: string
          elite: boolean
          in_top100: boolean
          next_milestone: number
          percentile: number
          points: number
          points_to_next: number
          rank: number
          total: number
        }[]
      }
      rank_scan: {
        Args: never
        Returns: {
          active_habits: number
          best_habit: string
          best_habit_rate: number
          coin_rank: number
          coins: number
          completions_30d: number
          consistency_30d: number
          longest_streak: number
          percentile: number
          streak: number
          streak_rank: number
          total_users: number
          weakest_habit: string
          weakest_habit_rate: number
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
      save_onboarding_step: {
        Args: { _answers: Json; _step: number }
        Returns: undefined
      }
      save_wake_plan: {
        Args: { _mode: string; _slot: string; _tone: string }
        Returns: string
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
      wake_slot_reward: { Args: { _slot: string }; Returns: number }
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
