import type { EventTeam, Member } from "@/types";

export type EventTeamMemberRow = {
  event_team_id: string;
  member_id: string;
  members: Member | Member[] | null;
};

export type NonLineupTeam = {
  teamCode: EventTeam["team_code"];
  displayName: string;
  members: (Pick<Member, "id" | "name"> & { dailyGoals: number })[];
};

function normalizeMember(value: Member | Member[] | null): Member | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function buildNonLineupTeams(
  eventTeams: EventTeam[],
  memberships: EventTeamMemberRow[],
  lineupMemberIds: Set<string>,
  dailyGoalsByMember: Record<string, number>
): NonLineupTeam[] {
  return eventTeams.flatMap((team) => {
    const members = memberships
      .filter(
        (membership) =>
          membership.event_team_id === team.id &&
          !lineupMemberIds.has(membership.member_id)
      )
      .flatMap((membership) => {
        const member = normalizeMember(membership.members);
        return member
          ? [
              {
                id: member.id,
                name: member.name,
                dailyGoals: dailyGoalsByMember[membership.member_id] ?? 0,
              },
            ]
          : [];
      });

    return members.length > 0
      ? [
          {
            teamCode: team.team_code,
            displayName: team.display_name,
            members,
          },
        ]
      : [];
  });
}
