import type { SupabaseClient } from "@supabase/supabase-js";

type Relationship<
  ForeignKeyName extends string,
  Columns extends string[],
  ReferencedRelation extends string,
  ReferencedColumns extends string[],
> = {
  foreignKeyName: ForeignKeyName;
  columns: Columns;
  isOneToOne: false;
  referencedRelation: ReferencedRelation;
  referencedColumns: ReferencedColumns;
};

type Table<Row, Insert = Partial<Row>, Relationships = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type EventTurnRow = {
  id: string;
  event_id: string;
  turn_number: number;
  created_at: string;
};

type TurnTeamMemberRow = {
  id: string;
  event_turn_id: string;
  event_id: string;
  event_team_id: string;
  member_id: string;
  created_at: string;
};

type GoalRow = {
  id: string;
  match_id: string | null;
  event_turn_id: string | null;
  member_id: string;
  scored_at: string | null;
  created_at: string | null;
};

export type TurnScoringDatabase = {
  public: {
    Tables: {
      event_turns: Table<
        EventTurnRow,
        Omit<EventTurnRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        }
      >;
      turn_team_members: Table<TurnTeamMemberRow>;
      event_teams: Table<{
        id: string;
        event_id: string;
        team_code: string;
        display_name: string;
        sort_order: number;
        created_at: string;
      }>;
      matches: Table<{
        id: string;
        event_id: string;
        match_number: number;
        active_started_at: string | null;
        created_at: string | null;
        elapsed_seconds: number;
        ended_at: string | null;
        started_at: string | null;
        status: string;
      }>;
      match_lineups: Table<
        {
          id: string;
          match_id: string;
          match_team_id: string;
          member_id: string;
          is_playing: boolean;
          team: string;
          created_at: string | null;
        },
        Partial<{
          id: string;
          match_id: string;
          match_team_id: string;
          member_id: string;
          is_playing: boolean;
          team: string;
          created_at: string | null;
        }>,
        [Relationship<
          "match_lineups_member_id_fkey",
          ["member_id"],
          "members",
          ["id"]
        >]
      >;
      match_teams: Table<
        {
          id: string;
          match_id: string;
          event_id: string;
          event_team_id: string;
          side: number;
          created_at: string;
        },
        Partial<{
          id: string;
          match_id: string;
          event_id: string;
          event_team_id: string;
          side: number;
          created_at: string;
        }>,
        [Relationship<
          "match_teams_event_team_fkey",
          ["event_id", "event_team_id"],
          "event_teams",
          ["event_id", "id"]
        >]
      >;
      members: Table<{
        id: string;
        name: string;
        created_at: string | null;
      }>;
      goals: Table<
        GoalRow,
        {
          id?: string;
          match_id?: string | null;
          event_turn_id?: string | null;
          member_id: string;
          scored_at?: string | null;
          created_at?: string | null;
        }
      >;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export function asTurnScoringClient(client: unknown) {
  return client as SupabaseClient<TurnScoringDatabase>;
}
