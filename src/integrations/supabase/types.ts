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
      banks: {
        Row: {
          balance: number
          company_id: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          balance?: number
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          balance?: number
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_costs: {
        Row: {
          amount: number
          budget_id: string
          category: string
          created_at: string
          description: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          budget_id: string
          category?: string
          created_at?: string
          description: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          budget_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_costs_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          agenda_tag: string | null
          city: string | null
          client: string
          client_type: string | null
          commission_name: string | null
          commission_percent: number
          commission_value: number
          company_id: string | null
          cost: number
          created_at: string
          discount_cash: number
          done: boolean
          end_date: string | null
          id: string
          margin_percent: number
          markup: number
          net_profit: number
          pay_commission: boolean
          payment_method: string | null
          product: string
          sale_value: number
          signal_value: number
          start_date: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          agenda_tag?: string | null
          city?: string | null
          client: string
          client_type?: string | null
          commission_name?: string | null
          commission_percent?: number
          commission_value?: number
          company_id?: string | null
          cost?: number
          created_at?: string
          discount_cash?: number
          done?: boolean
          end_date?: string | null
          id?: string
          margin_percent?: number
          markup?: number
          net_profit?: number
          pay_commission?: boolean
          payment_method?: string | null
          product: string
          sale_value?: number
          signal_value?: number
          start_date?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          agenda_tag?: string | null
          city?: string | null
          client?: string
          client_type?: string | null
          commission_name?: string | null
          commission_percent?: number
          commission_value?: number
          company_id?: string | null
          cost?: number
          created_at?: string
          discount_cash?: number
          done?: boolean
          end_date?: string | null
          id?: string
          margin_percent?: number
          markup?: number
          net_profit?: number
          pay_commission?: boolean
          payment_method?: string | null
          product?: string
          sale_value?: number
          signal_value?: number
          start_date?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          cnpj: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          daily_rate: number
          id: string
          monthly_salary: number
          name: string
          pay_type: string
          role: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          daily_rate?: number
          id?: string
          monthly_salary?: number
          name: string
          pay_type?: string
          role?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          daily_rate?: number
          id?: string
          monthly_salary?: number
          name?: string
          pay_type?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      income_statement_audit: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          statement_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          statement_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          statement_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      income_statements: {
        Row: {
          base_year: number
          company_id: string | null
          contributions: number
          created_at: string
          exempt_income: number
          id: string
          ir_withheld: number
          notes: string | null
          origin: string
          raw_data: Json | null
          source_cnpj: string | null
          source_name: string
          status: string
          taxable_income: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_year?: number
          company_id?: string | null
          contributions?: number
          created_at?: string
          exempt_income?: number
          id?: string
          ir_withheld?: number
          notes?: string | null
          origin?: string
          raw_data?: Json | null
          source_cnpj?: string | null
          source_name: string
          status?: string
          taxable_income?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_year?: number
          company_id?: string | null
          contributions?: number
          created_at?: string
          exempt_income?: number
          id?: string
          ir_withheld?: number
          notes?: string | null
          origin?: string
          raw_data?: Json | null
          source_cnpj?: string | null
          source_name?: string
          status?: string
          taxable_income?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      metrics: {
        Row: {
          budget_amount: number
          category: string
          company_id: string | null
          created_at: string
          id: string
          ideal_percent: number
          real_amount: number
          user_id: string
        }
        Insert: {
          budget_amount?: number
          category: string
          company_id?: string | null
          created_at?: string
          id?: string
          ideal_percent?: number
          real_amount?: number
          user_id: string
        }
        Update: {
          budget_amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ideal_percent?: number
          real_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nf_records: {
        Row: {
          amount: number
          client: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          issue_date: string
          number: string | null
          receivable_id: string | null
          series: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          client?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          issue_date?: string
          number?: string | null
          receivable_id?: string | null
          series?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          client?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          issue_date?: string
          number?: string | null
          receivable_id?: string | null
          series?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_distributions: {
        Row: {
          amount: number
          created_at: string
          distribution_id: string
          id: string
          partner_id: string
          partner_name: string
          share_percent: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          distribution_id: string
          id?: string
          partner_id: string
          partner_name: string
          share_percent?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          distribution_id?: string
          id?: string
          partner_id?: string
          partner_name?: string
          share_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_distributions_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "profit_distributions"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_withdrawals: {
        Row: {
          amount: number
          applied_to_prolabore: boolean
          bank_id: string | null
          company_id: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          partner_id: string
          partner_name: string
          user_id: string
        }
        Insert: {
          amount?: number
          applied_to_prolabore?: boolean
          bank_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          partner_id: string
          partner_name: string
          user_id: string
        }
        Update: {
          amount?: number
          applied_to_prolabore?: boolean
          bank_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          partner_id?: string
          partner_name?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          document: string | null
          id: string
          name: string
          pro_labore: number
          role: string | null
          share_percent: number
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          document?: string | null
          id?: string
          name: string
          pro_labore?: number
          role?: string | null
          share_percent?: number
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          pro_labore?: number
          role?: string | null
          share_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          amount: number
          category: string
          company_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          paid: boolean
          priority: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          company_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          paid?: boolean
          priority: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          paid?: boolean
          priority?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profit_distributions: {
        Row: {
          company_id: string | null
          costs: number
          created_at: string
          expenses: number
          id: string
          mode: string
          net_profit: number
          notes: string | null
          period_end: string
          period_label: string
          period_start: string
          revenue: number
          taxes: number
          total_distributed: number
          user_id: string
        }
        Insert: {
          company_id?: string | null
          costs?: number
          created_at?: string
          expenses?: number
          id?: string
          mode?: string
          net_profit?: number
          notes?: string | null
          period_end: string
          period_label: string
          period_start: string
          revenue?: number
          taxes?: number
          total_distributed?: number
          user_id: string
        }
        Update: {
          company_id?: string | null
          costs?: number
          created_at?: string
          expenses?: number
          id?: string
          mode?: string
          net_profit?: number
          notes?: string | null
          period_end?: string
          period_label?: string
          period_start?: string
          revenue?: number
          taxes?: number
          total_distributed?: number
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client: string | null
          company_id: string | null
          created_at: string
          deadline: string | null
          id: string
          name: string
          notes: string | null
          progress: number
          responsible: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client?: string | null
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          name: string
          notes?: string | null
          progress?: number
          responsible?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client?: string | null
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          name?: string
          notes?: string | null
          progress?: number
          responsible?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          client: string
          company_id: string | null
          cost: number
          created_at: string
          due_date: string | null
          id: string
          project: string | null
          received: boolean
          user_id: string
        }
        Insert: {
          amount: number
          client: string
          company_id?: string | null
          cost?: number
          created_at?: string
          due_date?: string | null
          id?: string
          project?: string | null
          received?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          client?: string
          company_id?: string | null
          cost?: number
          created_at?: string
          due_date?: string | null
          id?: string
          project?: string | null
          received?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          company_id: string | null
          contact: string | null
          created_at: string
          id: string
          last_price: number | null
          name: string
          notes: string | null
          product: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          last_price?: number | null
          name: string
          notes?: string | null
          product?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          last_price?: number | null
          name?: string
          notes?: string | null
          product?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          alert_red_percent: number
          alert_yellow_percent: number
          annual_limit: number
          cnae_main: string | null
          cnae_secondary: string[] | null
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          regime: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_red_percent?: number
          alert_yellow_percent?: number
          annual_limit?: number
          cnae_main?: string | null
          cnae_secondary?: string[] | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          regime?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_red_percent?: number
          alert_yellow_percent?: number
          annual_limit?: number
          cnae_main?: string | null
          cnae_secondary?: string[] | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          regime?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          company_id: string | null
          created_at: string
          daily_rate: number
          date: string
          employee_id: string | null
          id: string
          lunch_in: string | null
          lunch_out: string | null
          notes: string | null
          pay_type: string
          user_id: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          company_id?: string | null
          created_at?: string
          daily_rate?: number
          date?: string
          employee_id?: string | null
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          pay_type?: string
          user_id: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          company_id?: string | null
          created_at?: string
          daily_rate?: number
          date?: string
          employee_id?: string | null
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          notes?: string | null
          pay_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          bank_id: string | null
          category: string | null
          company_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          active_company_id: string | null
          created_at: string
          id: string
          link_accounting_to_dashboard: boolean
          popup_show_agenda: boolean
          popup_show_budgets: boolean
          popup_show_payables: boolean
          popup_show_receivables: boolean
          show_pending_popup: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          active_company_id?: string | null
          created_at?: string
          id?: string
          link_accounting_to_dashboard?: boolean
          popup_show_agenda?: boolean
          popup_show_budgets?: boolean
          popup_show_payables?: boolean
          popup_show_receivables?: boolean
          show_pending_popup?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          active_company_id?: string | null
          created_at?: string
          id?: string
          link_accounting_to_dashboard?: boolean
          popup_show_agenda?: boolean
          popup_show_budgets?: boolean
          popup_show_payables?: boolean
          popup_show_receivables?: boolean
          show_pending_popup?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_active_company_id_fkey"
            columns: ["active_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
