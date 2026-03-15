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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_tokens: {
        Row: {
          action: string
          created_at: string
          expires_at: string
          id: string
          source_type: string | null
          task_id: string
          used: boolean
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          source_type?: string | null
          task_id: string
          used?: boolean
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          source_type?: string | null
          task_id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      admin_login_log: {
        Row: {
          id: string
          logged_in_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          id?: string
          logged_in_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          id?: string
          logged_in_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          created_at: string
          id: string
          notes: string | null
          status: string | null
          status_changed_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          category: string
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          source_id: string | null
          source_type: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          category?: string
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          source_id?: string | null
          source_type?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          category?: string
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          source_id?: string | null
          source_type?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checked_items: {
        Row: {
          checked_at: string
          created_at: string
          id: string
          notes: string | null
          title: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          title: string
          user_id: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      course_lessons: {
        Row: {
          completed: boolean | null
          course_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          scheduled_date: string | null
          sort_order: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          course_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          scheduled_date?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          course_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          scheduled_date?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_recommendations: string | null
          created_at: string
          id: string
          notes: string | null
          status: string | null
          status_changed_at: string | null
          syllabus: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_recommendations?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          syllabus?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_recommendations?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          syllabus?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_board_items: {
        Row: {
          archived: boolean
          board_id: string
          category: string | null
          created_at: string
          id: string
          notes: string | null
          sheet_name: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          board_id: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sheet_name?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          board_id?: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sheet_name?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "custom_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_boards: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          show_in_dashboard: boolean
          sort_order: number
          statuses: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          show_in_dashboard?: boolean
          sort_order?: number
          statuses?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          show_in_dashboard?: boolean
          sort_order?: number
          statuses?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_stopwatch: {
        Row: {
          accumulated_seconds: number
          current_date_str: string
          id: string
          running: boolean
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accumulated_seconds?: number
          current_date_str?: string
          id?: string
          running?: boolean
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accumulated_seconds?: number
          current_date_str?: string
          id?: string
          running?: boolean
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mental_coaching_sessions: {
        Row: {
          created_at: string
          difficulty_level: number
          id: string
          messages: Json
          task_description: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty_level?: number
          id?: string
          messages?: Json
          task_description: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty_level?: number
          id?: string
          messages?: Json
          task_description?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_conversations: {
        Row: {
          conversation_date: string
          created_at: string
          id: string
          messages: Json
          tasks_snapshot: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_date?: string
          created_at?: string
          id?: string
          messages?: Json
          tasks_snapshot?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_date?: string
          created_at?: string
          id?: string
          messages?: Json
          tasks_snapshot?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      podcasts: {
        Row: {
          created_at: string
          host: string | null
          id: string
          notes: string | null
          status: string | null
          status_changed_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          host?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          host?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          pin_code: string | null
          pin_enabled: boolean
          preferred_language: string
          updated_at: string
          user_id: string
          username: string | null
          welcome_email_sent: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          pin_code?: string | null
          pin_enabled?: boolean
          preferred_language?: string
          updated_at?: string
          user_id: string
          username?: string | null
          welcome_email_sent?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          pin_code?: string | null
          pin_enabled?: boolean
          preferred_language?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          welcome_email_sent?: boolean
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_email: string
          job_title: string | null
          project_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_email: string
          job_title?: string | null
          project_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          job_title?: string | null
          project_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_email: string | null
          assigned_to: string | null
          completed: boolean | null
          created_at: string
          id: string
          notes: string | null
          project_id: string
          sort_order: number | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_email?: string | null
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          sort_order?: number | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_email?: string | null
          assigned_to?: string | null
          completed?: boolean | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          sort_order?: number | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          links: string[] | null
          status: string | null
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          links?: string[] | null
          status?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          links?: string[] | null
          status?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      recurring_task_completions: {
        Row: {
          completed_at: string
          completed_date: string
          id: string
          recurring_task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completed_date?: string
          id?: string
          recurring_task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          completed_date?: string
          id?: string
          recurring_task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_completions_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          frequency: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sent_notifications: {
        Row: {
          channel: string
          created_at: string
          event_id: string | null
          id: string
          notification_type: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_id?: string | null
          id?: string
          notification_type: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_id?: string | null
          id?: string
          notification_type?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shows: {
        Row: {
          air_date: string | null
          category: string | null
          created_at: string
          current_episode: number | null
          current_season: number | null
          id: string
          notes: string | null
          status: string | null
          status_changed_at: string | null
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          air_date?: string | null
          category?: string | null
          created_at?: string
          current_episode?: number | null
          current_season?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          air_date?: string | null
          category?: string | null
          created_at?: string
          current_episode?: number | null
          current_season?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          status_changed_at?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_sheet_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_display_name: string | null
          invited_email: string
          invited_username: string | null
          permission: string
          sheet_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_display_name?: string | null
          invited_email: string
          invited_username?: string | null
          permission?: string
          sheet_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_display_name?: string | null
          invited_email?: string
          invited_username?: string | null
          permission?: string
          sheet_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_sheet_collaborators_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "task_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sheets: {
        Row: {
          created_at: string
          id: string
          sheet_name: string
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sheet_name: string
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sheet_name?: string
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived: boolean
          category: string | null
          created_at: string
          creator_email: string | null
          creator_name: string | null
          creator_user_id: string | null
          creator_username: string | null
          description: string
          id: string
          overdue: boolean | null
          planned_end: string | null
          progress: string | null
          responsible: string | null
          sheet_name: string | null
          status: string | null
          status_notes: string | null
          task_type: string
          updated_at: string
          urgent: boolean | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_at?: string
          creator_email?: string | null
          creator_name?: string | null
          creator_user_id?: string | null
          creator_username?: string | null
          description: string
          id?: string
          overdue?: boolean | null
          planned_end?: string | null
          progress?: string | null
          responsible?: string | null
          sheet_name?: string | null
          status?: string | null
          status_notes?: string | null
          task_type?: string
          updated_at?: string
          urgent?: boolean | null
          user_id: string
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_at?: string
          creator_email?: string | null
          creator_name?: string | null
          creator_user_id?: string | null
          creator_username?: string | null
          description?: string
          id?: string
          overdue?: boolean | null
          planned_end?: string | null
          progress?: string | null
          responsible?: string | null
          sheet_name?: string | null
          status?: string | null
          status_notes?: string | null
          task_type?: string
          updated_at?: string
          urgent?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          custom_categories: Json
          hidden_tabs: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_categories?: Json
          hidden_tabs?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_categories?: Json
          hidden_tabs?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_sheet: {
        Args: { _sheet_id: string; _user_id: string }
        Returns: boolean
      }
      get_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_sheet_collaborator: {
        Args: { _sheet_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
