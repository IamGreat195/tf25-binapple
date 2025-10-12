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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          message: string
          mission_id: string
          resolved: boolean | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          message: string
          mission_id: string
          resolved?: boolean | null
          severity: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string
          mission_id?: string
          resolved?: boolean | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          area_hectares: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          polygon: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          area_hectares?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          polygon: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          area_hectares?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          polygon?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          altitude_meters: number
          area_covered_hectares: number | null
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          field_id: string
          id: string
          mission_type: Database["public"]["Enums"]["mission_type"]
          name: string
          pathline: Json
          speed_ms: number
          started_at: string | null
          status: Database["public"]["Enums"]["mission_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          altitude_meters: number
          area_covered_hectares?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          field_id: string
          id?: string
          mission_type?: Database["public"]["Enums"]["mission_type"]
          name: string
          pathline: Json
          speed_ms: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          altitude_meters?: number
          area_covered_hectares?: number | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          field_id?: string
          id?: string
          mission_type?: Database["public"]["Enums"]["mission_type"]
          name?: string
          pathline?: Json
          speed_ms?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      telemetry: {
        Row: {
          altitude_meters: number
          battery_percent: number
          current: number | null
          id: string
          infection_score: number | null
          latitude: number
          longitude: number
          mission_id: string
          progress: number | null
          speed_ms: number
          temperature: number | null
          timestamp: string | null
          voltage: number | null
          weed_score: number | null
          yield_score: number | null
        }
        Insert: {
          altitude_meters: number
          battery_percent: number
          current?: number | null
          id?: string
          infection_score?: number | null
          latitude: number
          longitude: number
          mission_id: string
          progress?: number | null
          speed_ms: number
          temperature?: number | null
          timestamp?: string | null
          voltage?: number | null
          weed_score?: number | null
          yield_score?: number | null
        }
        Update: {
          altitude_meters?: number
          battery_percent?: number
          current?: number | null
          id?: string
          infection_score?: number | null
          latitude?: number
          longitude?: number
          mission_id?: string
          progress?: number | null
          speed_ms?: number
          temperature?: number | null
          timestamp?: string | null
          voltage?: number | null
          weed_score?: number | null
          yield_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      mission_status: "planned" | "running" | "paused" | "completed" | "aborted"
      mission_type: "spraying" | "scouting" | "mapping" | "custom"
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
      app_role: ["admin", "user"],
      mission_status: ["planned", "running", "paused", "completed", "aborted"],
      mission_type: ["spraying", "scouting", "mapping", "custom"],
    },
  },
} as const
