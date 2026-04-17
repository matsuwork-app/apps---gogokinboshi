export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          event_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_date: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      event_participants: {
        Row: {
          id: string;
          event_id: string;
          member_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          member_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          member_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_participants_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          id: string;
          event_id: string;
          match_number: number;
          status: "pending" | "active" | "paused" | "finished";
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          match_number?: number;
          status?: "pending" | "active" | "paused" | "finished";
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          match_number?: number;
          status?: "pending" | "active" | "paused" | "finished";
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      match_lineups: {
        Row: {
          id: string;
          match_id: string;
          member_id: string;
          team: "A" | "B";
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          member_id: string;
          team: "A" | "B";
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          member_id?: string;
          team?: "A" | "B";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_lineups_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          id: string;
          match_id: string;
          member_id: string;
          scored_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          member_id: string;
          scored_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          member_id?: string;
          scored_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      playing_intervals: {
        Row: {
          id: string;
          match_id: string;
          member_id: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          member_id: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          member_id?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playing_intervals_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playing_intervals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
