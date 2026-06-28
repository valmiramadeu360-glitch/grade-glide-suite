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
      books: {
        Row: {
          author: string | null
          created_at: string
          discipline_id: string
          end_date: string | null
          id: string
          material_format: string
          pages_read: number | null
          reading_status: string
          start_date: string | null
          title: string
          total_pages: number | null
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          discipline_id: string
          end_date?: string | null
          id?: string
          material_format?: string
          pages_read?: number | null
          reading_status?: string
          start_date?: string | null
          title: string
          total_pages?: number | null
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          discipline_id?: string
          end_date?: string | null
          id?: string
          material_format?: string
          pages_read?: number | null
          reading_status?: string
          start_date?: string | null
          title?: string
          total_pages?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campuses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          completed: boolean | null
          created_at: string
          discipline_id: string
          id: string
          sort_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          discipline_id: string
          id?: string
          sort_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          discipline_id?: string
          id?: string
          sort_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_subtopics: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          parent_item_id: string
          sort_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          parent_item_id: string
          sort_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          parent_item_id?: string
          sort_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_subtopics_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      course_periods: {
        Row: {
          course_id: string
          created_at: string
          id: string
          name: string | null
          number: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          name?: string | null
          number: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          name?: string | null
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_periods_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          area: string | null
          campus_id: string
          created_at: string
          degree: string
          id: string
          name: string
          total_periods: number | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          campus_id: string
          created_at?: string
          degree?: string
          id?: string
          name: string
          total_periods?: number | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          campus_id?: string
          created_at?: string
          degree?: string
          id?: string
          name?: string
          total_periods?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      discipline_schedules: {
        Row: {
          day_of_week: number
          discipline_id: string
          end_time: string
          id: string
          room: string | null
          start_time: string
          user_id: string
        }
        Insert: {
          day_of_week: number
          discipline_id: string
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          user_id: string
        }
        Update: {
          day_of_week?: number
          discipline_id?: string
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_schedules_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          archived: boolean | null
          color: string | null
          created_at: string
          current_grade: number | null
          id: string
          is_extra_course: boolean | null
          name: string
          professor: string | null
          semester_label: string | null
          semester_number: number | null
          subject_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          color?: string | null
          created_at?: string
          current_grade?: number | null
          id?: string
          is_extra_course?: boolean | null
          name: string
          professor?: string | null
          semester_label?: string | null
          semester_number?: number | null
          subject_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean | null
          color?: string | null
          created_at?: string
          current_grade?: number | null
          id?: string
          is_extra_course?: boolean | null
          name?: string
          professor?: string | null
          semester_label?: string | null
          semester_number?: number | null
          subject_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplines_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          is_anonymous: boolean | null
          media_url: string | null
          message: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          email?: string | null
          id?: string
          is_anonymous?: boolean | null
          media_url?: string | null
          message: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          is_anonymous?: boolean | null
          media_url?: string | null
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string | null
          follower_id: string | null
          following_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          created_at: string
          discipline_id: string
          file_path: string | null
          id: string
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discipline_id: string
          file_path?: string | null
          id?: string
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discipline_id?: string
          file_path?: string | null
          id?: string
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          discipline_id: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          discipline_id: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          discipline_id?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          media_url: string | null
          tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_url?: string | null
          tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_url?: string | null
          tag?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          campus_id: string | null
          career_goal: string | null
          course: string | null
          course_id: string | null
          created_at: string
          current_period: number | null
          current_semester_label: string | null
          full_name: string | null
          id: string
          is_banned: boolean | null
          is_public: boolean | null
          notification_email: boolean | null
          notification_end_time: string | null
          notification_frequency: string | null
          notification_push: boolean | null
          notification_start_time: string | null
          notification_volume: number | null
          portfolio_url: string | null
          semester: number | null
          semester_end: string | null
          semester_start: string | null
          social_links: Json | null
          study_plans: string | null
          university: string | null
          university_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          campus_id?: string | null
          career_goal?: string | null
          course?: string | null
          course_id?: string | null
          created_at?: string
          current_period?: number | null
          current_semester_label?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_public?: boolean | null
          notification_email?: boolean | null
          notification_end_time?: string | null
          notification_frequency?: string | null
          notification_push?: boolean | null
          notification_start_time?: string | null
          notification_volume?: number | null
          portfolio_url?: string | null
          semester?: number | null
          semester_end?: string | null
          semester_start?: string | null
          social_links?: Json | null
          study_plans?: string | null
          university?: string | null
          university_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          campus_id?: string | null
          career_goal?: string | null
          course?: string | null
          course_id?: string | null
          created_at?: string
          current_period?: number | null
          current_semester_label?: string | null
          full_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_public?: boolean | null
          notification_email?: boolean | null
          notification_end_time?: string | null
          notification_frequency?: string | null
          notification_push?: boolean | null
          notification_start_time?: string | null
          notification_volume?: number | null
          portfolio_url?: string | null
          semester?: number | null
          semester_end?: string | null
          semester_start?: string | null
          social_links?: Json | null
          study_plans?: string | null
          university?: string | null
          university_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          completed: boolean | null
          created_at: string
          discipline_id: string | null
          due_date: string
          id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          discipline_id?: string | null
          due_date: string
          id?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          discipline_id?: string | null
          due_date?: string
          id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "trending_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          course_id: string
          created_at: string
          id: string
          name: string
          period_number: number | null
          syllabus: string | null
          updated_at: string
          workload_hours: number | null
        }
        Insert: {
          code?: string | null
          course_id: string
          created_at?: string
          id?: string
          name: string
          period_number?: number | null
          syllabus?: string | null
          updated_at?: string
          workload_hours?: number | null
        }
        Update: {
          code?: string | null
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          period_number?: number | null
          syllabus?: string | null
          updated_at?: string
          workload_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          acronym: string
          city: string | null
          created_at: string
          id: string
          kind: string
          logo_url: string | null
          name: string
          state: string
          updated_at: string
          website: string | null
        }
        Insert: {
          acronym: string
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name: string
          state: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          acronym?: string
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          logo_url?: string | null
          name?: string
          state?: string
          updated_at?: string
          website?: string | null
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
      trending_posts: {
        Row: {
          comments_count: number | null
          content: string | null
          created_at: string | null
          engagement_score: number | null
          id: string | null
          likes_count: number | null
          media_url: string | null
          tag: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comments_count?: never
          content?: string | null
          created_at?: string | null
          engagement_score?: never
          id?: string | null
          likes_count?: never
          media_url?: string | null
          tag?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comments_count?: never
          content?: string | null
          created_at?: string | null
          engagement_score?: never
          id?: string | null
          likes_count?: never
          media_url?: string | null
          tag?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "channel_admin"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
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
      app_role: ["admin", "moderator", "user", "channel_admin"],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
    },
  },
} as const
