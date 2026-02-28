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
          }
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
          }
        ]
      }
      disciplines: {
        Row: {
          color: string | null
          created_at: string
          current_grade: number | null
          id: string
          is_extra_course: boolean | null
          name: string
          professor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          current_grade?: number | null
          id?: string
          is_extra_course?: boolean | null
          name: string
          professor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          current_grade?: number | null
          id?: string
          is_extra_course?: boolean | null
          name?: string
          professor?: string | null
          updated_at?: string
          user_id?: string
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
          }
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
          }
        ]
      }
      profiles: {
        Row: {
          course: string | null
          created_at: string
          full_name: string | null
          id: string
          semester: number | null
          semester_end: string | null
          semester_start: string | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          semester?: number | null
          semester_end?: string | null
          semester_start?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          semester?: number | null
          semester_end?: string | null
          semester_start?: string | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  T extends keyof (Database["public"]["Tables"] & Database["public"]["Views"]),
> = (Database["public"]["Tables"] & Database["public"]["Views"])[T] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  T extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][T] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  T extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][T] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  T extends keyof Database["public"]["Enums"],
> = Database["public"]["Enums"][T]
