export type TurnPlayer = {
  id: string;
  name: string;
  turnGoals: number;
  dailyGoals: number;
  goalIds: string[];
};

export type TurnTeam = {
  id: string;
  teamCode: string;
  displayName: string;
  sortOrder: number;
  players: TurnPlayer[];
};

export function adjustTurnGoalCounts(
  teams: TurnTeam[],
  memberId: string,
  delta: 1 | -1
) {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) =>
      player.id === memberId
        ? {
            ...player,
            turnGoals: Math.max(0, player.turnGoals + delta),
            dailyGoals: Math.max(0, player.dailyGoals + delta),
          }
        : player
    ),
  }));
}

export function appendGoalId(
  teams: TurnTeam[],
  memberId: string,
  goalId: string
) {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) =>
      player.id === memberId
        ? { ...player, goalIds: [...player.goalIds, goalId] }
        : player
    ),
  }));
}

export function replaceGoalId(
  teams: TurnTeam[],
  memberId: string,
  previousId: string,
  nextId: string
) {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) =>
      player.id === memberId
        ? {
            ...player,
            goalIds: player.goalIds.map((id) =>
              id === previousId ? nextId : id
            ),
          }
        : player
    ),
  }));
}

export function removeGoalId(
  teams: TurnTeam[],
  memberId: string,
  goalId: string
) {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) =>
      player.id === memberId
        ? {
            ...player,
            goalIds: player.goalIds.filter((id) => id !== goalId),
          }
        : player
    ),
  }));
}
