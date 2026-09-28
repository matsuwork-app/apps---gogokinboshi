
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "app_users": {
                  Row: {
                    "auth_user_id": string,"avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"line_user_id": string,"role": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "auth_user_id": string,"avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id"?: string,"line_user_id": string,"role"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string,"avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"line_user_id"?: string,"role"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"e2e_environment_guard": {
                  Row: {
                    "marker": string
                  }
                  Insert: {
                    "marker": string
                  }
                  Update: {
                    "marker"?: string
                  }
                  Relationships: [

                  ]
                },"event_participants": {
                  Row: {
                    "created_at": string | null,"event_id": string,"id": string,"member_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"event_id": string,"id"?: string,"member_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"event_id"?: string,"id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_participants_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_participants_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"event_team_members": {
                  Row: {
                    "created_at": string,"event_id": string,"event_team_id": string,"id": string,"member_id": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"event_team_id": string,"id"?: string,"member_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"event_team_id"?: string,"id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_team_members_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_team_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_team_members_participant_fkey"
      columns: ["event_id","member_id"]
isOneToOne: true
      referencedRelation: "event_participants"
      referencedColumns: ["event_id","member_id"]
    },{
      foreignKeyName: "event_team_members_team_fkey"
      columns: ["event_id","event_team_id"]
isOneToOne: false
      referencedRelation: "event_teams"
      referencedColumns: ["event_id","id"]
    }
                  ]
                },"event_teams": {
                  Row: {
                    "created_at": string,"display_name": string,"event_id": string,"id": string,"sort_order": number,"team_code": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"event_id": string,"id"?: string,"sort_order": number,"team_code": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"event_id"?: string,"id"?: string,"sort_order"?: number,"team_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_turns": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"turn_number": number
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"turn_number": number
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"turn_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_turns_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string | null,"event_date": string,"id": string,"notes": string | null,"team_count": number
                  }
                  Insert: {
                    "created_at"?: string | null,"event_date"?: string,"id"?: string,"notes"?: string | null,"team_count"?: number
                  }
                  Update: {
                    "created_at"?: string | null,"event_date"?: string,"id"?: string,"notes"?: string | null,"team_count"?: number
                  }
                  Relationships: [

                  ]
                },"goals": {
                  Row: {
                    "created_at": string | null,"event_turn_id": string | null,"id": string,"match_id": string | null,"member_id": string,"scored_at": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"event_turn_id"?: string | null,"id"?: string,"match_id"?: string | null,"member_id": string,"scored_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"event_turn_id"?: string | null,"id"?: string,"match_id"?: string | null,"member_id"?: string,"scored_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goals_match_lineup_fkey"
      columns: ["match_id","member_id"]
isOneToOne: false
      referencedRelation: "match_lineups"
      referencedColumns: ["match_id","member_id"]
    },{
      foreignKeyName: "goals_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goals_turn_member_fkey"
      columns: ["event_turn_id","member_id"]
isOneToOne: false
      referencedRelation: "turn_team_members"
      referencedColumns: ["event_turn_id","member_id"]
    }
                  ]
                },"match_lineups": {
                  Row: {
                    "created_at": string | null,"id": string,"is_playing": boolean,"match_id": string,"match_team_id": string,"member_id": string,"team": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"is_playing"?: boolean,"match_id": string,"match_team_id": string,"member_id": string,"team": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"is_playing"?: boolean,"match_id"?: string,"match_team_id"?: string,"member_id"?: string,"team"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_lineups_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_lineups_match_team_fkey"
      columns: ["match_id","match_team_id"]
isOneToOne: false
      referencedRelation: "match_teams"
      referencedColumns: ["match_id","id"]
    },{
      foreignKeyName: "match_lineups_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"match_teams": {
                  Row: {
                    "created_at": string,"event_id": string,"event_team_id": string,"id": string,"match_id": string,"side": number
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"event_team_id": string,"id"?: string,"match_id": string,"side": number
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"event_team_id"?: string,"id"?: string,"match_id"?: string,"side"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_teams_event_team_fkey"
      columns: ["event_id","event_team_id"]
isOneToOne: false
      referencedRelation: "event_teams"
      referencedColumns: ["event_id","id"]
    },{
      foreignKeyName: "match_teams_match_fkey"
      columns: ["match_id","event_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id","event_id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "active_started_at": string | null,"created_at": string | null,"elapsed_seconds": number,"ended_at": string | null,"event_id": string,"id": string,"match_number": number,"started_at": string | null,"status": string
                  }
                  Insert: {
                    "active_started_at"?: string | null,"created_at"?: string | null,"elapsed_seconds"?: number,"ended_at"?: string | null,"event_id": string,"id"?: string,"match_number"?: number,"started_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "active_started_at"?: string | null,"created_at"?: string | null,"elapsed_seconds"?: number,"ended_at"?: string | null,"event_id"?: string,"id"?: string,"match_number"?: number,"started_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [

                  ]
                },"playing_intervals": {
                  Row: {
                    "created_at": string | null,"ended_at": string | null,"id": string,"match_id": string,"member_id": string,"started_at": string
                  }
                  Insert: {
                    "created_at"?: string | null,"ended_at"?: string | null,"id"?: string,"match_id": string,"member_id": string,"started_at"?: string
                  }
                  Update: {
                    "created_at"?: string | null,"ended_at"?: string | null,"id"?: string,"match_id"?: string,"member_id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playing_intervals_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playing_intervals_match_lineup_fkey"
      columns: ["match_id","member_id"]
isOneToOne: false
      referencedRelation: "match_lineups"
      referencedColumns: ["match_id","member_id"]
    },{
      foreignKeyName: "playing_intervals_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"turn_team_members": {
                  Row: {
                    "created_at": string,"event_id": string,"event_team_id": string,"event_turn_id": string,"id": string,"member_id": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"event_team_id": string,"event_turn_id": string,"id"?: string,"member_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"event_team_id"?: string,"event_turn_id"?: string,"id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "turn_team_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "turn_team_members_participant_fkey"
      columns: ["event_id","member_id"]
isOneToOne: false
      referencedRelation: "event_participants"
      referencedColumns: ["event_id","member_id"]
    },{
      foreignKeyName: "turn_team_members_team_fkey"
      columns: ["event_id","event_team_id"]
isOneToOne: false
      referencedRelation: "event_teams"
      referencedColumns: ["event_id","id"]
    },{
      foreignKeyName: "turn_team_members_turn_fkey"
      columns: ["event_turn_id","event_id"]
isOneToOne: false
      referencedRelation: "event_turns"
      referencedColumns: ["id","event_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_event_turn":
{ Args: { "p_assignments": Json,"p_event_id": string }; Returns: {
              "turn_id": string,"turn_number": number
            }[]
                           },
"create_event_with_teams":
{ Args: { "p_event_date": string,"p_notes": string,"p_teams": Json }; Returns: string
                           },
"create_match_with_teams":
{ Args: { "p_event_id": string,"p_event_team_ids": (string)[],"p_lineups"?: Json }; Returns: string
                           },
"get_public_rankings":
{ Args: { "p_from_date": string,"p_to_date": string }; Returns: {
              "member_id": string,"name": string,"participated_events": number,"rank": number,"total_events": number,"total_goals": number
            }[]
                           },
"is_app_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_approved_app_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"reassign_event_team_members":
{ Args: { "p_assignments": Json,"p_event_id": string }; Returns: undefined
                           },
"set_player_playing":
{ Args: { "p_is_playing": boolean,"p_match_id": string,"p_member_id": string }; Returns: undefined
                           },
"transition_match":
{ Args: { "p_expected_status": string,"p_match_id": string,"p_next_status": string }; Returns: {
              "active_started_at": string | null,
"created_at": string | null,
"elapsed_seconds": number,
"ended_at": string | null,
"event_id": string,
"id": string,
"match_number": number,
"started_at": string | null,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "matches"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
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

          }
        }
} as const
