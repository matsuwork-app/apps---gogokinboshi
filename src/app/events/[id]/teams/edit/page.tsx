import Link from "next/link";
import { notFound } from "next/navigation";

import { hasManagerSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TeamEditForm, {
  type MemberForTeamEdit,
  type TeamForEdit,
} from "./TeamEditForm";

type TeamRow = {
  id: string;
  team_code: string;
  display_name: string;
  sort_order: number;
};

type MemberRelation = { id: string; name: string };

type ParticipantRow = {
  member_id: string;
  members: MemberRelation | MemberRelation[] | null;
};

type MembershipRow = {
  member_id: string;
  event_team_id: string;
};

function normalizeMember(
  value: MemberRelation | MemberRelation[] | null,
): MemberRelation | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function TeamEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const initialCanManage = await hasManagerSession();

  const { data: event } = await supabase
    .from("events")
    .select("id,event_date")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const [teamsResult, participantsResult, membershipsResult, goalsResult, matchesResult] =
    await Promise.all([
      supabase
        .from("event_teams")
        .select("id,team_code,display_name,sort_order")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabase
        .from("event_participants")
        .select("member_id,members(id,name)")
        .eq("event_id", eventId),
      supabase
        .from("event_team_members")
        .select("member_id,event_team_id")
        .eq("event_id", eventId),
      supabase
        .from("goals")
        .select("member_id,matches!inner(event_id)")
        .eq("matches.event_id", eventId),
      supabase.from("matches").select("status").eq("event_id", eventId),
    ]);

  const loadError = [
    teamsResult.error,
    participantsResult.error,
    membershipsResult.error,
    goalsResult.error,
    matchesResult.error,
  ].find((error) => error !== null);
  if (loadError) {
    throw new Error("チーム編成データの読み込みに失敗しました", {
      cause: loadError,
    });
  }

  const teamRows = (teamsResult.data ?? []) as TeamRow[];
  if (teamRows.length < 2 || teamRows.length > 4) notFound();

  const teams: TeamForEdit[] = teamRows.map((team) => ({
    id: team.id,
    teamCode: team.team_code,
    displayName: team.display_name,
    sortOrder: team.sort_order,
  }));
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const membershipByMember = new Map(
    memberships.map((membership) => [
      membership.member_id,
      membership.event_team_id,
    ]),
  );
  const dailyGoals = new Map<string, number>();
  (goalsResult.data ?? []).forEach(({ member_id }) => {
    dailyGoals.set(member_id, (dailyGoals.get(member_id) ?? 0) + 1);
  });

  const members: MemberForTeamEdit[] = (
    (participantsResult.data ?? []) as unknown as ParticipantRow[]
  )
    .flatMap((participant) => {
      const member = normalizeMember(participant.members);
      return member
        ? [
            {
              ...member,
              eventTeamId: membershipByMember.get(member.id) ?? "",
              dailyGoals: dailyGoals.get(member.id) ?? 0,
            },
          ]
        : [];
    })
    .sort((first, second) => first.name.localeCompare(second.name, "ja"));

  const hasUnfinishedMatch = (matchesResult.data ?? []).some(
    ({ status }) => status !== "finished",
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← イベント詳細へ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-bold">チーム編成を変更</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {new Date(event.event_date).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Tokyo",
          })}
        </p>
      </div>

      <TeamEditForm
        eventId={eventId}
        teams={teams}
        members={members}
        hasUnfinishedMatch={hasUnfinishedMatch}
        initialCanManage={initialCanManage}
      />
    </div>
  );
}
