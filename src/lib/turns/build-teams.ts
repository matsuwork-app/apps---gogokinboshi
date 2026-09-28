import type { TurnTeam } from "./scoring";

type TeamSource = {
  id: string;
  team_code: string;
  display_name: string;
  sort_order: number;
};

type MembershipSource = {
  event_team_id: string;
  member_id: string;
};

type MemberSource = {
  id: string;
  name: string;
};

type GoalSource = {
  member_id: string;
};

type TurnGoalSource = GoalSource & {
  id: string;
  event_turn_id: string | null;
};

export function buildTurnTeams({
  currentTurnId,
  eventTeams,
  memberships,
  members,
  legacyGoals,
  turnGoals,
}: {
  currentTurnId: string;
  eventTeams: TeamSource[];
  memberships: MembershipSource[];
  members: MemberSource[];
  legacyGoals: GoalSource[];
  turnGoals: TurnGoalSource[];
}): TurnTeam[] {
  const dailyGoalsByMember = [...legacyGoals, ...turnGoals].reduce<
    Record<string, number>
  >((totals, goal) => {
    totals[goal.member_id] = (totals[goal.member_id] ?? 0) + 1;
    return totals;
  }, {});
  const currentTurnGoals = turnGoals.filter(
    (goal) => goal.event_turn_id === currentTurnId
  );
  const membersById = new Map(members.map((member) => [member.id, member] as const));

  return [...eventTeams]
    .sort((first, second) => first.sort_order - second.sort_order)
    .map((team) => ({
      id: team.id,
      teamCode: team.team_code,
      displayName: team.display_name,
      sortOrder: team.sort_order,
      players: memberships.flatMap((membership) => {
        if (membership.event_team_id !== team.id) return [];
        const member = membersById.get(membership.member_id);
        if (!member) return [];
        const goals = currentTurnGoals.filter(
          (goal) => goal.member_id === membership.member_id
        );
        return [
          {
            id: member.id,
            name: member.name,
            turnGoals: goals.length,
            dailyGoals: dailyGoalsByMember[member.id] ?? 0,
            goalIds: goals.map((goal) => goal.id),
          },
        ];
      }),
    }));
}
