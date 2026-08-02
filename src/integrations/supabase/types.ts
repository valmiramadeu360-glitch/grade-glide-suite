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
      admin_announcements: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          poll_options: Json | null
          starts_at: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          poll_options?: Json | null
          starts_at?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          poll_options?: Json | null
          starts_at?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_chat_threads: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcement_poll_votes: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          option_index: number
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          option_index: number
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          option_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_poll_votes_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "admin_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
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
      campus_blocks: {
        Row: {
          campus_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          photo_url: string | null
          updated_at: string
          x_percent: number
          y_percent: number
        }
        Insert: {
          campus_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          photo_url?: string | null
          updated_at?: string
          x_percent: number
          y_percent: number
        }
        Update: {
          campus_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          updated_at?: string
          x_percent?: number
          y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "campus_blocks_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_buildings: {
        Row: {
          building_number: number
          category: string
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: string | null
          photo_url: string | null
          services: string[] | null
        }
        Insert: {
          building_number: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: string | null
          photo_url?: string | null
          services?: string[] | null
        }
        Update: {
          building_number?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: string | null
          photo_url?: string | null
          services?: string[] | null
        }
        Relationships: []
      }
      campuses: {
        Row: {
          city: string | null
          created_at: string
          id: string
          map_image_url: string | null
          name: string
          state: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          map_image_url?: string | null
          name: string
          state?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          map_image_url?: string | null
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
      communities: {
        Row: {
          campus_id: string | null
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          member_count: number
          name: string
          period_number: number | null
          type: Database["public"]["Enums"]["community_type"]
          university_id: string | null
          updated_at: string
        }
        Insert: {
          campus_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number
          name: string
          period_number?: number | null
          type: Database["public"]["Enums"]["community_type"]
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          campus_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number
          name?: string
          period_number?: number | null
          type?: Database["public"]["Enums"]["community_type"]
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["community_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
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
      discipline_community_messages: {
        Row: {
          content: string
          created_at: string
          discipline_code: string
          id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          discipline_code: string
          id?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          discipline_code?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discipline_community_messages_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          code: string | null
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
          code?: string | null
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
          code?: string | null
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
      extra_courses: {
        Row: {
          certificate_url: string | null
          completed_at: string | null
          created_at: string
          id: string
          institution: string | null
          name: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          workload_hours: number | null
        }
        Insert: {
          certificate_url?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          institution?: string | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workload_hours?: number | null
        }
        Update: {
          certificate_url?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          institution?: string | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workload_hours?: number | null
        }
        Relationships: []
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
      news_channels: {
        Row: {
          banner_url: string | null
          campus_id: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          member_count: number
          name: string
          scope: Database["public"]["Enums"]["news_channel_scope"]
          university_id: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          campus_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          member_count?: number
          name: string
          scope?: Database["public"]["Enums"]["news_channel_scope"]
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          campus_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          member_count?: number
          name?: string
          scope?: Database["public"]["Enums"]["news_channel_scope"]
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_channels_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_channels_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_channels_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          author_id: string
          channel_id: string
          content: string
          cover_url: string | null
          created_at: string
          id: string
          link_url: string | null
          pinned: boolean
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          channel_id: string
          content: string
          cover_url?: string | null
          created_at?: string
          id?: string
          link_url?: string | null
          pinned?: boolean
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          channel_id?: string
          content?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          link_url?: string | null
          pinned?: boolean
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "news_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      news_subscriptions: {
        Row: {
          channel_id: string
          subscribed_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          subscribed_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          subscribed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_subscriptions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "news_channels"
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
      post_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      post_polls: {
        Row: {
          created_at: string
          id: string
          options: Json
          post_id: string
          question: string
        }
        Insert: {
          created_at?: string
          id?: string
          options: Json
          post_id: string
          question: string
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json
          post_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
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
          category: string | null
          community_id: string | null
          content: string
          created_at: string
          document_url: string | null
          event_at: string | null
          event_location: string | null
          id: string
          is_sold: boolean | null
          link_url: string | null
          media_type: string
          media_url: string | null
          media_urls: string[] | null
          original_price: number | null
          price: number | null
          tag: string | null
          title: string | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          category?: string | null
          community_id?: string | null
          content: string
          created_at?: string
          document_url?: string | null
          event_at?: string | null
          event_location?: string | null
          id?: string
          is_sold?: boolean | null
          link_url?: string | null
          media_type?: string
          media_url?: string | null
          media_urls?: string[] | null
          original_price?: number | null
          price?: number | null
          tag?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          category?: string | null
          community_id?: string | null
          content?: string
          created_at?: string
          document_url?: string | null
          event_at?: string | null
          event_location?: string | null
          id?: string
          is_sold?: boolean | null
          link_url?: string | null
          media_type?: string
          media_url?: string | null
          media_urls?: string[] | null
          original_price?: number | null
          price?: number | null
          tag?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          campus_id: string | null
          career_goal: string | null
          codename: string | null
          course: string | null
          course_id: string | null
          created_at: string
          current_period: number | null
          current_semester_label: string | null
          display_name: string | null
          full_name: string | null
          hide_name: boolean
          id: string
          is_anonymous: boolean | null
          is_banned: boolean | null
          is_public: boolean | null
          notification_email: boolean | null
          notification_end_time: string | null
          notification_frequency: string | null
          notification_push: boolean | null
          notification_start_time: string | null
          notification_volume: number | null
          portfolio_url: string | null
          privacy_dm: string
          privacy_posts: string
          privacy_profile: string
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
          codename?: string | null
          course?: string | null
          course_id?: string | null
          created_at?: string
          current_period?: number | null
          current_semester_label?: string | null
          display_name?: string | null
          full_name?: string | null
          hide_name?: boolean
          id?: string
          is_anonymous?: boolean | null
          is_banned?: boolean | null
          is_public?: boolean | null
          notification_email?: boolean | null
          notification_end_time?: string | null
          notification_frequency?: string | null
          notification_push?: boolean | null
          notification_start_time?: string | null
          notification_volume?: number | null
          portfolio_url?: string | null
          privacy_dm?: string
          privacy_posts?: string
          privacy_profile?: string
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
          codename?: string | null
          course?: string | null
          course_id?: string | null
          created_at?: string
          current_period?: number | null
          current_semester_label?: string | null
          display_name?: string | null
          full_name?: string | null
          hide_name?: boolean
          id?: string
          is_anonymous?: boolean | null
          is_banned?: boolean | null
          is_public?: boolean | null
          notification_email?: boolean | null
          notification_end_time?: string | null
          notification_frequency?: string | null
          notification_push?: boolean | null
          notification_start_time?: string | null
          notification_volume?: number | null
          portfolio_url?: string | null
          privacy_dm?: string
          privacy_posts?: string
          privacy_profile?: string
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
      ru_menus: {
        Row: {
          created_at: string
          id: string
          is_official: boolean
          items: Json
          meal: Database["public"]["Enums"]["ru_meal"]
          nutrition: Json | null
          photo_url: string | null
          raw_text: string | null
          restaurant_id: string
          service_date: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_official?: boolean
          items?: Json
          meal?: Database["public"]["Enums"]["ru_meal"]
          nutrition?: Json | null
          photo_url?: string | null
          raw_text?: string | null
          restaurant_id: string
          service_date?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_official?: boolean
          items?: Json
          meal?: Database["public"]["Enums"]["ru_meal"]
          nutrition?: Json | null
          photo_url?: string | null
          raw_text?: string | null
          restaurant_id?: string
          service_date?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ru_menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "ru_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ru_notices: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          restaurant_id: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id: string
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ru_notices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "ru_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ru_queue_reports: {
        Row: {
          created_at: string
          distance_meters: number
          id: string
          latitude: number
          level: Database["public"]["Enums"]["ru_queue_level"]
          longitude: number
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distance_meters: number
          id?: string
          latitude: number
          level: Database["public"]["Enums"]["ru_queue_level"]
          longitude: number
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          distance_meters?: number
          id?: string
          latitude?: number
          level?: Database["public"]["Enums"]["ru_queue_level"]
          longitude?: number
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ru_queue_reports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "ru_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ru_ratings: {
        Row: {
          cleanliness: number | null
          created_at: string
          food: number | null
          id: string
          restaurant_id: string
          service: number | null
          service_date: string
          updated_at: string
          user_id: string
          waiting: number | null
        }
        Insert: {
          cleanliness?: number | null
          created_at?: string
          food?: number | null
          id?: string
          restaurant_id: string
          service?: number | null
          service_date?: string
          updated_at?: string
          user_id: string
          waiting?: number | null
        }
        Update: {
          cleanliness?: number | null
          created_at?: string
          food?: number | null
          id?: string
          restaurant_id?: string
          service?: number | null
          service_date?: string
          updated_at?: string
          user_id?: string
          waiting?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ru_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "ru_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ru_restaurants: {
        Row: {
          campus_id: string | null
          closed_reason: string | null
          created_at: string
          description: string | null
          dinner_end: string | null
          dinner_start: string | null
          id: string
          is_open: boolean
          latitude: number
          longitude: number
          lunch_end: string | null
          lunch_start: string | null
          name: string
          notice: string | null
          radius_meters: number
          updated_at: string
        }
        Insert: {
          campus_id?: string | null
          closed_reason?: string | null
          created_at?: string
          description?: string | null
          dinner_end?: string | null
          dinner_start?: string | null
          id?: string
          is_open?: boolean
          latitude: number
          longitude: number
          lunch_end?: string | null
          lunch_start?: string | null
          name: string
          notice?: string | null
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          campus_id?: string | null
          closed_reason?: string | null
          created_at?: string
          description?: string | null
          dinner_end?: string | null
          dinner_start?: string | null
          id?: string
          is_open?: boolean
          latitude?: number
          longitude?: number
          lunch_end?: string | null
          lunch_start?: string | null
          name?: string
          notice?: string | null
          radius_meters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ru_restaurants_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      ru_status_reports: {
        Row: {
          campus_id: string | null
          created_at: string
          estimated_minutes: number
          id: string
          status_level: string
          user_id: string
        }
        Insert: {
          campus_id?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          status_level: string
          user_id: string
        }
        Update: {
          campus_id?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          status_level?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ru_status_reports_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
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
      can_dm_user: {
        Args: { _receiver: string; _sender: string }
        Returns: boolean
      }
      can_view_user_posts: {
        Args: { _author: string; _viewer: string }
        Returns: boolean
      }
      get_announcement_poll_totals: {
        Args: { _announcement_id: string }
        Returns: {
          option_index: number
          votes: number
        }[]
      }
      get_post_poll_totals: {
        Args: { _poll_id: string }
        Returns: {
          option_index: number
          votes: number
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_following: {
        Args: { _follower: string; _following: string }
        Returns: boolean
      }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      owns_discipline_code: {
        Args: { _code: string; _user_id: string }
        Returns: boolean
      }
      ru_distance_meters: {
        Args: { _lat1: number; _lat2: number; _lon1: number; _lon2: number }
        Returns: number
      }
      ru_peak_hours: {
        Args: { _restaurant_id: string }
        Returns: {
          avg_score: number
          hour: number
          reports: number
        }[]
      }
      ru_queue_status: {
        Args: { _restaurant_id: string }
        Returns: {
          confidence: string
          last_report_at: string
          level: Database["public"]["Enums"]["ru_queue_level"]
          sample_size: number
          score: number
        }[]
      }
      ru_rating_summary: {
        Args: { _restaurant_id: string }
        Returns: {
          cleanliness: number
          food: number
          service: number
          total: number
          waiting: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "channel_admin"
        | "student_verified"
        | "professor"
        | "university_official"
        | "company"
        | "library"
        | "ru"
        | "project"
      community_role: "member" | "moderator" | "admin"
      community_type: "university" | "campus" | "course" | "period"
      news_channel_scope: "global" | "university" | "campus" | "course"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
      ru_meal: "lunch" | "dinner"
      ru_queue_level: "none" | "small" | "medium" | "large"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "channel_admin",
        "student_verified",
        "professor",
        "university_official",
        "company",
        "library",
        "ru",
        "project",
      ],
      community_role: ["member", "moderator", "admin"],
      community_type: ["university", "campus", "course", "period"],
      news_channel_scope: ["global", "university", "campus", "course"],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      ru_meal: ["lunch", "dinner"],
      ru_queue_level: ["none", "small", "medium", "large"],
    },
  },
} as const
