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
      app_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          created_at: string
          id: string
          is_banned: boolean
          nickname: string
          phone: string | null
          wechat_openid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_banned?: boolean
          nickname?: string
          phone?: string | null
          wechat_openid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_banned?: boolean
          nickname?: string
          phone?: string | null
          wechat_openid?: string | null
        }
        Relationships: []
      }
      copy_logics: {
        Row: {
          created_at: string
          description: string
          formatting: Json
          id: string
          is_active: boolean
          modules: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          formatting?: Json
          id?: string
          is_active?: boolean
          modules?: Json
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          formatting?: Json
          id?: string
          is_active?: boolean
          modules?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_logics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_versions: {
        Row: {
          created_at: string
          id: string
          label: string | null
          owner_id: string | null
          project_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          owner_id?: string | null
          project_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          owner_id?: string | null
          project_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "copy_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      export_tokens: {
        Row: {
          created_at: string
          expires_at: string
          project_id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          project_id: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          project_id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_orders: {
        Row: {
          closed_at: string | null
          cover_image_url: string | null
          created_at: string
          ends_at: string | null
          external_refs: Json
          gmv_cents: number
          id: string
          items_sold: number
          order_count: number
          owner_id: string
          project_id: string
          slug: string
          snapshot_delivery: Json
          snapshot_intro: Json
          snapshot_skus: Json
          started_at: string
          status: Database["public"]["Enums"]["group_order_status"]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          closed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          ends_at?: string | null
          external_refs?: Json
          gmv_cents?: number
          id?: string
          items_sold?: number
          order_count?: number
          owner_id: string
          project_id: string
          slug: string
          snapshot_delivery?: Json
          snapshot_intro?: Json
          snapshot_skus?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["group_order_status"]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          closed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          ends_at?: string | null
          external_refs?: Json
          gmv_cents?: number
          id?: string
          items_sold?: number
          order_count?: number
          owner_id?: string
          project_id?: string
          slug?: string
          snapshot_delivery?: Json
          snapshot_intro?: Json
          snapshot_skus?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["group_order_status"]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_orders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          payload: Json
          processed_at: string | null
          project_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          order_id: string
          qty: number
          sku_index: number
          sku_name: string
          subtotal_cents: number
          unit_price_cents: number
          variant_index: number | null
          variant_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id: string
          qty?: number
          sku_index?: number
          sku_name: string
          subtotal_cents?: number
          unit_price_cents?: number
          variant_index?: number | null
          variant_label?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id?: string
          qty?: number
          sku_index?: number
          sku_name?: string
          subtotal_cents?: number
          unit_price_cents?: number
          variant_index?: number | null
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: Json
          buyer_name: string
          buyer_phone: string
          cancelled_at: string | null
          channel: string
          completed_at: string | null
          created_at: string
          group_order_id: string
          id: string
          items_count: number
          note: string
          order_no: string
          owner_id: string
          paid_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          project_id: string
          query_code: string
          refunded_at: string | null
          shipped_at: string | null
          shipping_carrier: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
          tracking_no: string | null
          updated_at: string
        }
        Insert: {
          address: Json
          buyer_name: string
          buyer_phone: string
          cancelled_at?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          group_order_id: string
          id?: string
          items_count?: number
          note?: string
          order_no: string
          owner_id: string
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id: string
          query_code: string
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_carrier?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          tracking_no?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          buyer_name?: string
          buyer_phone?: string
          cancelled_at?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          group_order_id?: string
          id?: string
          items_count?: number
          note?: string
          order_no?: string
          owner_id?: string
          paid_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          project_id?: string
          query_code?: string
          refunded_at?: string | null
          shipped_at?: string | null
          shipping_carrier?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          tracking_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_group_order_id_fkey"
            columns: ["group_order_id"]
            isOneToOne: false
            referencedRelation: "group_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_copy_logics: {
        Row: {
          created_at: string
          description: string
          formatting: Json
          id: string
          industry: string
          is_published: boolean
          modules: Json
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          formatting?: Json
          id?: string
          industry?: string
          is_published?: boolean
          modules?: Json
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          formatting?: Json
          id?: string
          industry?: string
          is_published?: boolean
          modules?: Json
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_images: {
        Row: {
          analysis: Json | null
          created_at: string
          id: string
          owner_id: string | null
          project_id: string
          role: string
          sort_order: number
          source: string
          url: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          id?: string
          owner_id?: string | null
          project_id: string
          role?: string
          sort_order?: number
          source?: string
          url: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          id?: string
          owner_id?: string | null
          project_id?: string
          role?: string
          sort_order?: number
          source?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_images_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          chat_messages: Json
          cover_image_url: string | null
          created_at: string
          delivery: Json
          id: string
          intro: Json
          name: string
          notes: string | null
          owner_id: string | null
          product: Json
          schedule: Json
          settings: Json
          skus: Json
          status: string
          updated_at: string
        }
        Insert: {
          chat_messages?: Json
          cover_image_url?: string | null
          created_at?: string
          delivery?: Json
          id?: string
          intro?: Json
          name?: string
          notes?: string | null
          owner_id?: string | null
          product?: Json
          schedule?: Json
          settings?: Json
          skus?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          chat_messages?: Json
          cover_image_url?: string | null
          created_at?: string
          delivery?: Json
          id?: string
          intro?: Json
          name?: string
          notes?: string | null
          owner_id?: string | null
          product?: Json
          schedule?: Json
          settings?: Json
          skus?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_templates: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sms_verification_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string
          id: string
          phone: string
          provider: string
          provider_request_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at: string
          id?: string
          phone: string
          provider?: string
          provider_request_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          phone?: string
          provider?: string
          provider_request_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      wechat_login_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string
          session_token: string | null
          state: string
          status: string
          user_id: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          session_token?: string | null
          state: string
          status?: string
          user_id?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          session_token?: string | null
          state?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wechat_login_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
      group_order_status: "draft" | "active" | "closed"
      order_status:
        | "pending"
        | "paid"
        | "shipped"
        | "completed"
        | "refunded"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded"
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
      group_order_status: ["draft", "active", "closed"],
      order_status: [
        "pending",
        "paid",
        "shipped",
        "completed",
        "refunded",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
    },
  },
} as const
