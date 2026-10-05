
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string,"id": number,"new_values": Json | null,"occurred_at": string,"old_values": Json | null,"record_id": string,"table_name": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role": string,"id"?: never,"new_values"?: Json | null,"occurred_at"?: string,"old_values"?: Json | null,"record_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string,"id"?: never,"new_values"?: Json | null,"occurred_at"?: string,"old_values"?: Json | null,"record_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consent_records": {
                  Row: {
                    "captured_at": string,"client_ip_hash": string | null,"customer_id": string,"enquiry_id": string | null,"granted": boolean,"id": string,"method": Database["public"]['Enums']["consent_method"],"notice_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"recorded_by": string | null,"user_agent": string | null
                  }
                  Insert: {
                    "captured_at"?: string,"client_ip_hash"?: string | null,"customer_id": string,"enquiry_id"?: string | null,"granted": boolean,"id"?: string,"method": Database["public"]['Enums']["consent_method"],"notice_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"recorded_by"?: string | null,"user_agent"?: string | null
                  }
                  Update: {
                    "captured_at"?: string,"client_ip_hash"?: string | null,"customer_id"?: string,"enquiry_id"?: string | null,"granted"?: boolean,"id"?: string,"method"?: Database["public"]['Enums']["consent_method"],"notice_version"?: string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"recorded_by"?: string | null,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_records_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_records_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: false
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_records_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"line_id": string | null,"notes": string | null,"phone": string | null,"preferred_channel": Database["public"]['Enums']["contact_channel"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"line_id"?: string | null,"notes"?: string | null,"phone"?: string | null,"preferred_channel"?: Database["public"]['Enums']["contact_channel"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"line_id"?: string | null,"notes"?: string | null,"phone"?: string | null,"preferred_channel"?: Database["public"]['Enums']["contact_channel"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enquiries": {
                  Row: {
                    "assigned_to": string | null,"client_ip_hash": string | null,"contact_name": string,"contact_phone": string,"created_at": string,"customer_id": string,"fingerprint": string | null,"id": string,"idempotency_key": string | null,"message": string | null,"preferred_channel": Database["public"]['Enums']["contact_channel"],"product": Database["public"]['Enums']["insurance_product"] | null,"reference": string,"source": Database["public"]['Enums']["enquiry_source"],"status": Database["public"]['Enums']["enquiry_status"],"travel_days": number | null,"travel_destination": string | null,"travellers": number | null,"type": Database["public"]['Enums']["enquiry_type"],"updated_at": string,"user_agent": string | null,"vehicle_id": string | null
                  }
                  Insert: {
                    "assigned_to"?: string | null,"client_ip_hash"?: string | null,"contact_name": string,"contact_phone": string,"created_at"?: string,"customer_id": string,"fingerprint"?: string | null,"id"?: string,"idempotency_key"?: string | null,"message"?: string | null,"preferred_channel"?: Database["public"]['Enums']["contact_channel"],"product"?: Database["public"]['Enums']["insurance_product"] | null,"reference"?: string,"source": Database["public"]['Enums']["enquiry_source"],"status"?: Database["public"]['Enums']["enquiry_status"],"travel_days"?: number | null,"travel_destination"?: string | null,"travellers"?: number | null,"type": Database["public"]['Enums']["enquiry_type"],"updated_at"?: string,"user_agent"?: string | null,"vehicle_id"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"client_ip_hash"?: string | null,"contact_name"?: string,"contact_phone"?: string,"created_at"?: string,"customer_id"?: string,"fingerprint"?: string | null,"id"?: string,"idempotency_key"?: string | null,"message"?: string | null,"preferred_channel"?: Database["public"]['Enums']["contact_channel"],"product"?: Database["public"]['Enums']["insurance_product"] | null,"reference"?: string,"source"?: Database["public"]['Enums']["enquiry_source"],"status"?: Database["public"]['Enums']["enquiry_status"],"travel_days"?: number | null,"travel_destination"?: string | null,"travellers"?: number | null,"type"?: Database["public"]['Enums']["enquiry_type"],"updated_at"?: string,"user_agent"?: string | null,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "enquiries_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enquiries_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enquiries_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"enquiry_status_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"enquiry_id": string,"from_status": Database["public"]['Enums']["enquiry_status"] | null,"id": number,"to_status": Database["public"]['Enums']["enquiry_status"]
                  }
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"enquiry_id": string,"from_status"?: Database["public"]['Enums']["enquiry_status"] | null,"id"?: never,"to_status": Database["public"]['Enums']["enquiry_status"]
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"enquiry_id"?: string,"from_status"?: Database["public"]['Enums']["enquiry_status"] | null,"id"?: never,"to_status"?: Database["public"]['Enums']["enquiry_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "enquiry_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enquiry_status_history_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: false
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_up_activities": {
                  Row: {
                    "activity_type": Database["public"]['Enums']["activity_type"],"created_at": string,"customer_id": string,"enquiry_id": string | null,"id": string,"next_action_at": string | null,"occurred_at": string,"outcome": string | null,"policy_id": string | null,"staff_user_id": string | null,"summary": string,"updated_at": string
                  }
                  Insert: {
                    "activity_type": Database["public"]['Enums']["activity_type"],"created_at"?: string,"customer_id": string,"enquiry_id"?: string | null,"id"?: string,"next_action_at"?: string | null,"occurred_at"?: string,"outcome"?: string | null,"policy_id"?: string | null,"staff_user_id"?: string | null,"summary": string,"updated_at"?: string
                  }
                  Update: {
                    "activity_type"?: Database["public"]['Enums']["activity_type"],"created_at"?: string,"customer_id"?: string,"enquiry_id"?: string | null,"id"?: string,"next_action_at"?: string | null,"occurred_at"?: string,"outcome"?: string | null,"policy_id"?: string | null,"staff_user_id"?: string | null,"summary"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_activities_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_activities_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: false
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_activities_policy_id_fkey"
      columns: ["policy_id"]
isOneToOne: false
      referencedRelation: "policies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_activities_staff_user_id_fkey"
      columns: ["staff_user_id"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    }
                  ]
                },"follow_up_tasks": {
                  Row: {
                    "assigned_to": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"due_date": string,"enquiry_id": string | null,"id": string,"notes": string | null,"policy_id": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "assigned_to"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"due_date": string,"enquiry_id"?: string | null,"id"?: string,"notes"?: string | null,"policy_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"due_date"?: string,"enquiry_id"?: string | null,"id"?: string,"notes"?: string | null,"policy_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follow_up_tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_tasks_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_tasks_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: false
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follow_up_tasks_policy_id_fkey"
      columns: ["policy_id"]
isOneToOne: false
      referencedRelation: "policies"
      referencedColumns: ["id"]
    }
                  ]
                },"insurers": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"name_en": string | null,"name_th": string,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_en"?: string | null,"name_th": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_en"?: string | null,"name_th"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"policies": {
                  Row: {
                    "created_at": string,"customer_id": string,"end_date": string,"id": string,"insurer_id": string,"policy_number": string,"premium": number,"product": Database["public"]['Enums']["insurance_product"],"quotation_id": string | null,"start_date": string,"status": Database["public"]['Enums']["policy_status"],"updated_at": string,"vehicle_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"customer_id": string,"end_date": string,"id"?: string,"insurer_id": string,"policy_number": string,"premium": number,"product": Database["public"]['Enums']["insurance_product"],"quotation_id"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["policy_status"],"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"end_date"?: string,"id"?: string,"insurer_id"?: string,"policy_number"?: string,"premium"?: number,"product"?: Database["public"]['Enums']["insurance_product"],"quotation_id"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["policy_status"],"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "policies_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "policies_insurer_id_fkey"
      columns: ["insurer_id"]
isOneToOne: false
      referencedRelation: "insurers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "policies_quotation_id_fkey"
      columns: ["quotation_id"]
isOneToOne: true
      referencedRelation: "quotations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "policies_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"quotations": {
                  Row: {
                    "created_at": string,"deductible": number | null,"enquiry_id": string,"id": string,"insurer_id": string,"notes": string | null,"premium": number,"prepared_by": string | null,"product": Database["public"]['Enums']["insurance_product"],"repair_type": string | null,"status": Database["public"]['Enums']["quotation_status"],"sum_insured": number | null,"updated_at": string,"valid_until": string | null
                  }
                  Insert: {
                    "created_at"?: string,"deductible"?: number | null,"enquiry_id": string,"id"?: string,"insurer_id": string,"notes"?: string | null,"premium": number,"prepared_by"?: string | null,"product": Database["public"]['Enums']["insurance_product"],"repair_type"?: string | null,"status"?: Database["public"]['Enums']["quotation_status"],"sum_insured"?: number | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"deductible"?: number | null,"enquiry_id"?: string,"id"?: string,"insurer_id"?: string,"notes"?: string | null,"premium"?: number,"prepared_by"?: string | null,"product"?: Database["public"]['Enums']["insurance_product"],"repair_type"?: string | null,"status"?: Database["public"]['Enums']["quotation_status"],"sum_insured"?: number | null,"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotations_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: false
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_insurer_id_fkey"
      columns: ["insurer_id"]
isOneToOne: false
      referencedRelation: "insurers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotations_prepared_by_fkey"
      columns: ["prepared_by"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    }
                  ]
                },"renewal_job_runs": {
                  Row: {
                    "finished_at": string | null,"id": number,"lead_days": number,"policies_checked": number,"reminders_created": number,"run_date": string,"started_at": string,"tasks_created": number,"trigger_source": string,"triggered_by": string | null
                  }
                  Insert: {
                    "finished_at"?: string | null,"id"?: never,"lead_days": number,"policies_checked"?: number,"reminders_created"?: number,"run_date": string,"started_at"?: string,"tasks_created"?: number,"trigger_source": string,"triggered_by"?: string | null
                  }
                  Update: {
                    "finished_at"?: string | null,"id"?: never,"lead_days"?: number,"policies_checked"?: number,"reminders_created"?: number,"run_date"?: string,"started_at"?: string,"tasks_created"?: number,"trigger_source"?: string,"triggered_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "renewal_job_runs_triggered_by_fkey"
      columns: ["triggered_by"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    }
                  ]
                },"renewal_tasks": {
                  Row: {
                    "assigned_to": string | null,"completed_at": string | null,"created_at": string,"due_date": string,"id": string,"notes": string | null,"policy_id": string,"status": Database["public"]['Enums']["task_status"],"updated_at": string
                  }
                  Insert: {
                    "assigned_to"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_date": string,"id"?: string,"notes"?: string | null,"policy_id": string,"status"?: Database["public"]['Enums']["task_status"],"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_date"?: string,"id"?: string,"notes"?: string | null,"policy_id"?: string,"status"?: Database["public"]['Enums']["task_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "renewal_tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "renewal_tasks_policy_id_fkey"
      columns: ["policy_id"]
isOneToOne: false
      referencedRelation: "policies"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_reminders": {
                  Row: {
                    "created_at": string,"due_date": string | null,"follow_up_task_id": string | null,"id": string,"kind": string,"message": string,"read_at": string | null,"recipient_id": string | null,"renewal_task_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"due_date"?: string | null,"follow_up_task_id"?: string | null,"id"?: string,"kind": string,"message": string,"read_at"?: string | null,"recipient_id"?: string | null,"renewal_task_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"due_date"?: string | null,"follow_up_task_id"?: string | null,"id"?: string,"kind"?: string,"message"?: string,"read_at"?: string | null,"recipient_id"?: string | null,"renewal_task_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_reminders_follow_up_task_id_fkey"
      columns: ["follow_up_task_id"]
isOneToOne: false
      referencedRelation: "follow_up_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_reminders_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "staff_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_reminders_renewal_task_id_fkey"
      columns: ["renewal_task_id"]
isOneToOne: false
      referencedRelation: "renewal_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_users": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["staff_role"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"full_name": string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["staff_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vehicles": {
                  Row: {
                    "created_at": string,"customer_id": string,"description": string,"id": string,"is_ev": boolean,"make": string | null,"model": string | null,"model_year": number | null,"plate_province": string | null,"registration_plate": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"customer_id": string,"description": string,"id"?: string,"is_ev"?: boolean,"make"?: string | null,"model"?: string | null,"model_year"?: number | null,"plate_province"?: string | null,"registration_plate"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"description"?: string,"id"?: string,"is_ev"?: boolean,"make"?: string | null,"model"?: string | null,"model_year"?: number | null,"plate_province"?: string | null,"registration_plate"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "consume_rate_limit":
{ Args: { "p_bucket_key": string,"p_limit": number,"p_window_seconds": number }; Returns: Json
                           },
"convert_quotation_to_policy":
{ Args: { "p_end_date": string,"p_policy_number": string,"p_quotation_id": string,"p_start_date": string }; Returns: string
                           },
"crm_conversion_report":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"run_renewal_job":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"search_customers":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "created_at": string,
"email": string | null,
"full_name": string,
"id": string,
"line_id": string | null,
"notes": string | null,
"phone": string | null,
"preferred_channel": Database["public"]['Enums']["contact_channel"],
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "customers"
        isOneToOne: false
        isSetofReturn: true
      } },
"submit_enquiry":
{ Args: { "p": Json }; Returns: Json
                           }
          }
          Enums: {
            "activity_type": "call"|"line"|"email"|"meeting"|"note","consent_method": "web_form"|"phone"|"line"|"paper","consent_purpose": "quote_processing"|"marketing"|"sensitive_data","contact_channel": "phone"|"line"|"email","enquiry_source": "web_quote_form"|"web_contact_form"|"phone"|"line"|"walk_in"|"referral","enquiry_status": "new"|"contacted"|"quoting"|"quoted"|"won"|"lost"|"spam","enquiry_type": "quote"|"contact","insurance_product": "car_1"|"car_2plus"|"car_3plus"|"ev"|"compulsory"|"travel","policy_status": "pending"|"active"|"expired"|"cancelled","quotation_status": "draft"|"sent"|"accepted"|"declined"|"expired","staff_role": "admin"|"agent"|"viewer","task_status": "open"|"in_progress"|"done"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "activity_type": ["call", "line", "email", "meeting", "note"],"consent_method": ["web_form", "phone", "line", "paper"],"consent_purpose": ["quote_processing", "marketing", "sensitive_data"],"contact_channel": ["phone", "line", "email"],"enquiry_source": ["web_quote_form", "web_contact_form", "phone", "line", "walk_in", "referral"],"enquiry_status": ["new", "contacted", "quoting", "quoted", "won", "lost", "spam"],"enquiry_type": ["quote", "contact"],"insurance_product": ["car_1", "car_2plus", "car_3plus", "ev", "compulsory", "travel"],"policy_status": ["pending", "active", "expired", "cancelled"],"quotation_status": ["draft", "sent", "accepted", "declined", "expired"],"staff_role": ["admin", "agent", "viewer"],"task_status": ["open", "in_progress", "done", "cancelled"]
          }
        }
} as const
