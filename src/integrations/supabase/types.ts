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
      accountability_connections: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          invite_id: string | null
          partner_id: string
          share_status: boolean
          share_streak: boolean
          status: Database["public"]["Enums"]["accountability_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          invite_id?: string | null
          partner_id: string
          share_status?: boolean
          share_streak?: boolean
          status?: Database["public"]["Enums"]["accountability_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          invite_id?: string | null
          partner_id?: string
          share_status?: boolean
          share_streak?: boolean
          status?: Database["public"]["Enums"]["accountability_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountability_connections_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "accountability_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      accountability_events: {
        Row: {
          actor_id: string
          connection_id: string
          contract_id: string | null
          created_at: string
          id: string
          kind: string
          message: string | null
          recipient_id: string
        }
        Insert: {
          actor_id: string
          connection_id: string
          contract_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string
          connection_id?: string
          contract_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountability_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "accountability_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountability_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      accountability_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          id: string
          inviter_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          inviter_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
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
      coach_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          model: string | null
          next_check_in_at: string | null
          provider: string
          quality: Json
          session_id: string | null
          short_session_summary: string | null
          started_at: string
          user_agreed_next_action: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          model?: string | null
          next_check_in_at?: string | null
          provider?: string
          quality?: Json
          session_id?: string | null
          short_session_summary?: string | null
          started_at?: string
          user_agreed_next_action?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          model?: string | null
          next_check_in_at?: string | null
          provider?: string
          quality?: Json
          session_id?: string | null
          short_session_summary?: string | null
          started_at?: string
          user_agreed_next_action?: string | null
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
      contract_events: {
        Row: {
          contract_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["contract_status"] | null
          id: number
          kind: string
          meta: Json
          to_status: Database["public"]["Enums"]["contract_status"] | null
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["contract_status"] | null
          id?: never
          kind: string
          meta?: Json
          to_status?: Database["public"]["Enums"]["contract_status"] | null
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["contract_status"] | null
          id?: never
          kind?: string
          meta?: Json
          to_status?: Database["public"]["Enums"]["contract_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_sessions: {
        Row: {
          client_instance_id: string | null
          contract_id: string
          created_at: string
          elapsed_seconds: number | null
          ended_at: string | null
          exit_reason: string | null
          expected_end_at: string
          id: string
          session_status: Database["public"]["Enums"]["contract_session_status"]
          started_at: string
          user_id: string
        }
        Insert: {
          client_instance_id?: string | null
          contract_id: string
          created_at?: string
          elapsed_seconds?: number | null
          ended_at?: string | null
          exit_reason?: string | null
          expected_end_at: string
          id?: string
          session_status?: Database["public"]["Enums"]["contract_session_status"]
          started_at?: string
          user_id: string
        }
        Update: {
          client_instance_id?: string | null
          contract_id?: string
          created_at?: string
          elapsed_seconds?: number | null
          ended_at?: string | null
          exit_reason?: string | null
          expected_end_at?: string
          id?: string
          session_status?: Database["public"]["Enums"]["contract_session_status"]
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_sessions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_contracts: {
        Row: {
          accountability_enabled: boolean
          category: string
          coins_awarded: number
          completed_at: string | null
          created_at: string
          difficulty: number
          expires_at: string | null
          goal_id: string | null
          id: string
          is_recovery: boolean
          local_day: string
          planned_seconds: number
          private_note: string | null
          proof_method: string
          recovery_of_id: string | null
          rescue_seconds: number
          rewarded_at: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          timezone: string
          title: string
          trigger_text: string | null
          updated_at: string
          user_id: string
          version: number
          xp_awarded: number
        }
        Insert: {
          accountability_enabled?: boolean
          category: string
          coins_awarded?: number
          completed_at?: string | null
          created_at?: string
          difficulty?: number
          expires_at?: string | null
          goal_id?: string | null
          id?: string
          is_recovery?: boolean
          local_day: string
          planned_seconds: number
          private_note?: string | null
          proof_method: string
          recovery_of_id?: string | null
          rescue_seconds: number
          rewarded_at?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          timezone: string
          title: string
          trigger_text?: string | null
          updated_at?: string
          user_id: string
          version?: number
          xp_awarded?: number
        }
        Update: {
          accountability_enabled?: boolean
          category?: string
          coins_awarded?: number
          completed_at?: string | null
          created_at?: string
          difficulty?: number
          expires_at?: string | null
          goal_id?: string | null
          id?: string
          is_recovery?: boolean
          local_day?: string
          planned_seconds?: number
          private_note?: string | null
          proof_method?: string
          recovery_of_id?: string | null
          rescue_seconds?: number
          rewarded_at?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          timezone?: string
          title?: string
          trigger_text?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_contracts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_contracts_recovery_of_id_fkey"
            columns: ["recovery_of_id"]
            isOneToOne: false
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_top_tasks: {
        Row: {
          coins_awarded: number
          created_at: string
          day: string
          done: boolean
          id: string
          slot: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coins_awarded?: number
          created_at?: string
          day: string
          done?: boolean
          id?: string
          slot: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coins_awarded?: number
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          slot?: number
          title?: string
          updated_at?: string
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
      first_launch_assessments: {
        Row: {
          answers: Json
          baseline_score: number
          completed_at: string
          created_at: string
          estimated_daily_lost_hours: number
          potential_daily_reclaim_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          baseline_score: number
          completed_at?: string
          created_at?: string
          estimated_daily_lost_hours: number
          potential_daily_reclaim_hours: number
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          baseline_score?: number
          completed_at?: string
          created_at?: string
          estimated_daily_lost_hours?: number
          potential_daily_reclaim_hours?: number
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
      goal_habits: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_habits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_habits_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string | null
          celebrated: boolean
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          earned_coins: number
          id: string
          progress: number
          started_on: string
          target_coins: number
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          celebrated?: boolean
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          earned_coins?: number
          id?: string
          progress?: number
          started_on?: string
          target_coins?: number
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          celebrated?: boolean
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          earned_coins?: number
          id?: string
          progress?: number
          started_on?: string
          target_coins?: number
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
      proof_submissions: {
        Row: {
          confidence: number | null
          contract_id: string
          created_at: string
          id: string
          private_storage_path: string | null
          proof_type: string
          reason_code: string | null
          retry_count: number
          session_id: string | null
          status: Database["public"]["Enums"]["proof_status"]
          text_evidence: string | null
          user_id: string
          verified_at: string | null
          verifier_version: string | null
        }
        Insert: {
          confidence?: number | null
          contract_id: string
          created_at?: string
          id?: string
          private_storage_path?: string | null
          proof_type: string
          reason_code?: string | null
          retry_count?: number
          session_id?: string | null
          status?: Database["public"]["Enums"]["proof_status"]
          text_evidence?: string | null
          user_id: string
          verified_at?: string | null
          verifier_version?: string | null
        }
        Update: {
          confidence?: number | null
          contract_id?: string
          created_at?: string
          id?: string
          private_storage_path?: string | null
          proof_type?: string
          reason_code?: string | null
          retry_count?: number
          session_id?: string | null
          status?: Database["public"]["Enums"]["proof_status"]
          text_evidence?: string | null
          user_id?: string
          verified_at?: string | null
          verifier_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proof_submissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "contract_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      recovery_events: {
        Row: {
          created_at: string
          id: string
          original_contract_id: string
          reason: string | null
          recovery_contract_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_contract_id: string
          reason?: string | null
          recovery_contract_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_contract_id?: string
          reason?: string | null
          recovery_contract_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_events_original_contract_id_fkey"
            columns: ["original_contract_id"]
            isOneToOne: true
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_events_recovery_contract_id_fkey"
            columns: ["recovery_contract_id"]
            isOneToOne: true
            referencedRelation: "daily_contracts"
            referencedColumns: ["id"]
          },
        ]
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
          require_scan: boolean
          scan_classes: string[]
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
          require_scan?: boolean
          scan_classes?: string[]
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
          require_scan?: boolean
          scan_classes?: string[]
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
      accept_accountability_invite: {
        Args: { _token_hash: string }
        Returns: string
      }
      activate_axen_plan: { Args: { _answers: Json }; Returns: undefined }
      apply_daily_penalty: {
        Args: never
        Returns: {
          coins: number
          penalized: boolean
        }[]
      }
      award_contract: {
        Args: { _contract_id: string }
        Returns: {
          already_awarded: boolean
          coins: number
          xp: number
        }[]
      }
      axen_is_server_write: { Args: never; Returns: boolean }
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
      complete_top_task: {
        Args: { _slot: number }
        Returns: {
          all_done: boolean
          awarded: number
          coins: number
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
      create_accountability_invite: {
        Args: { _token_hash: string }
        Returns: string
      }
      end_contract_session: {
        Args: { _reason: string; _session_id: string }
        Returns: {
          client_instance_id: string | null
          contract_id: string
          created_at: string
          elapsed_seconds: number | null
          ended_at: string | null
          exit_reason: string | null
          expected_end_at: string
          id: string
          session_status: Database["public"]["Enums"]["contract_session_status"]
          started_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      get_partner_today: {
        Args: never
        Returns: {
          local_day: string
          partner_id: string
          status: Database["public"]["Enums"]["contract_status"]
        }[]
      }
      goal_overview: { Args: never; Returns: Json }
      goal_scheduled_count: {
        Args: { _frequency: string; _from: string; _to: string }
        Returns: number
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
      leave_pact: { Args: { _pact_id: string }; Returns: boolean }
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
      log_contract_event: {
        Args: {
          _contract: string
          _from: Database["public"]["Enums"]["contract_status"]
          _kind: string
          _meta?: Json
          _to: Database["public"]["Enums"]["contract_status"]
          _user: string
        }
        Returns: undefined
      }
      mark_goal_celebrated: { Args: { _goal_id: string }; Returns: undefined }
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
      recalc_goal: { Args: { _goal_id: string }; Returns: undefined }
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
      revoke_accountability_connection: {
        Args: { _block?: boolean; _connection_id: string }
        Returns: undefined
      }
      save_goal: {
        Args: {
          _category: string
          _goal_id: string
          _target_date: string
          _task_ids: string[]
          _title: string
        }
        Returns: string
      }
      save_onboarding_step: {
        Args: { _answers: Json; _step: number }
        Returns: undefined
      }
      save_wake_plan: {
        Args: { _mode: string; _slot: string; _tone: string }
        Returns: string
      }
      send_accountability_nudge: {
        Args: { _connection_id: string; _kind: string; _message?: string }
        Returns: undefined
      }
      send_friend_request: {
        Args: { _username: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      start_contract_session: {
        Args: { _client_instance?: string; _contract_id: string }
        Returns: {
          client_instance_id: string | null
          contract_id: string
          created_at: string
          elapsed_seconds: number | null
          ended_at: string | null
          exit_reason: string | null
          expected_end_at: string
          id: string
          session_status: Database["public"]["Enums"]["contract_session_status"]
          started_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "contract_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_recovery: {
        Args: { _original_id: string; _reason?: string }
        Returns: {
          accountability_enabled: boolean
          category: string
          coins_awarded: number
          completed_at: string | null
          created_at: string
          difficulty: number
          expires_at: string | null
          goal_id: string | null
          id: string
          is_recovery: boolean
          local_day: string
          planned_seconds: number
          private_note: string | null
          proof_method: string
          recovery_of_id: string | null
          rescue_seconds: number
          rewarded_at: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          timezone: string
          title: string
          trigger_text: string | null
          updated_at: string
          user_id: string
          version: number
          xp_awarded: number
        }
        SetofOptions: {
          from: "*"
          to: "daily_contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_streak_shield: {
        Args: never
        Returns: {
          applied: boolean
          reason: string
          shields: number
        }[]
      }
      verify_contract_proof: {
        Args: {
          _confidence: number
          _proof_id: string
          _reason: string
          _status: Database["public"]["Enums"]["proof_status"]
          _verifier: string
        }
        Returns: {
          confidence: number | null
          contract_id: string
          created_at: string
          id: string
          private_storage_path: string | null
          proof_type: string
          reason_code: string | null
          retry_count: number
          session_id: string | null
          status: Database["public"]["Enums"]["proof_status"]
          text_evidence: string | null
          user_id: string
          verified_at: string | null
          verifier_version: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proof_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wake_slot_reward: { Args: { _slot: string }; Returns: number }
    }
    Enums: {
      accountability_status: "active" | "revoked" | "blocked"
      contract_session_status: "active" | "completed" | "abandoned" | "expired"
      contract_status:
        | "draft"
        | "scheduled"
        | "active"
        | "proof_pending"
        | "verified"
        | "rewarded"
        | "missed"
      proof_status:
        | "submitted"
        | "verified"
        | "needs_review"
        | "retry_requested"
        | "rejected"
        | "unavailable"
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
    Enums: {
      accountability_status: ["active", "revoked", "blocked"],
      contract_session_status: ["active", "completed", "abandoned", "expired"],
      contract_status: [
        "draft",
        "scheduled",
        "active",
        "proof_pending",
        "verified",
        "rewarded",
        "missed",
      ],
      proof_status: [
        "submitted",
        "verified",
        "needs_review",
        "retry_requested",
        "rejected",
        "unavailable",
      ],
    },
  },
} as const
