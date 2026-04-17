import type { Database } from "./database";

export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type EventParticipant =
  Database["public"]["Tables"]["event_participants"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchLineup = Database["public"]["Tables"]["match_lineups"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type PlayingInterval =
  Database["public"]["Tables"]["playing_intervals"]["Row"];

export type RankingRow = {
  member_id: string;
  name: string;
  total_goals: number;
  participated_events: number;
  total_events: number;
  total_seconds: number;
  rank: number;
};

export type MatchWithLineups = Match & {
  match_lineups: (MatchLineup & { members: Member })[];
  goals: Goal[];
};

export type PlayerState = {
  member: Member;
  team: "A" | "B";
  goals: number;
  isPlaying: boolean;
  openIntervalId: string | null;
};
