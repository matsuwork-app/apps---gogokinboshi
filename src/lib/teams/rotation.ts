export type MatchPair = readonly [string, string];

const ROTATION_INDEXES: Record<2 | 3 | 4, readonly (readonly [number, number])[]> = {
  2: [[0, 1]],
  3: [
    [0, 1],
    [2, 0],
    [1, 2],
  ],
  4: [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ],
};

function assertTeamIds(teamIds: readonly string[]): asserts teamIds is readonly [
  string,
  string,
  ...string[],
] {
  if (teamIds.length < 2 || teamIds.length > 4) {
    throw new Error("team IDs must contain between 2 and 4 teams");
  }

  if (teamIds.some((teamId) => teamId.length === 0)) {
    throw new Error("team IDs must not be empty");
  }

  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("team IDs must be unique");
  }
}

function assertPair(teamIds: readonly string[], pair: MatchPair): void {
  const [firstTeamId, secondTeamId] = pair;

  if (firstTeamId === secondTeamId) {
    throw new Error("a team cannot play against itself");
  }

  if (!teamIds.includes(firstTeamId) || !teamIds.includes(secondTeamId)) {
    throw new Error("match pair contains an unknown team ID");
  }
}

function isSamePair(first: MatchPair, second: MatchPair): boolean {
  return (
    (first[0] === second[0] && first[1] === second[1]) ||
    (first[0] === second[1] && first[1] === second[0])
  );
}

/**
 * Returns one complete round-robin rotation in the order used by the UI.
 */
export function getRotation(teamIds: readonly string[]): MatchPair[] {
  assertTeamIds(teamIds);

  const indexes = ROTATION_INDEXES[teamIds.length as 2 | 3 | 4];

  return indexes.map(([firstIndex, secondIndex]) => [
    teamIds[firstIndex],
    teamIds[secondIndex],
  ]);
}

/**
 * Recommends the first rotation card with the fewest appearances in history.
 *
 * Counting cards instead of using `history.length % rotation.length` keeps the
 * recommendation fair when an operator manually plays a later card early.
 */
export function getNextRecommendedPair(
  teamIds: readonly string[],
  history: readonly MatchPair[],
): MatchPair {
  const rotation = getRotation(teamIds);
  const appearanceCounts = rotation.map(() => 0);

  for (const playedPair of history) {
    assertPair(teamIds, playedPair);
    const rotationIndex = rotation.findIndex((rotationPair) =>
      isSamePair(rotationPair, playedPair),
    );

    // With 2–4 unique teams the rotation contains every possible valid pair.
    appearanceCounts[rotationIndex] += 1;
  }

  const minimumAppearances = Math.min(...appearanceCounts);
  const recommendationIndex = appearanceCounts.indexOf(minimumAppearances);

  return rotation[recommendationIndex];
}

/** Returns teams that are resting during the supplied match. */
export function getRestingTeamIds(
  teamIds: readonly string[],
  playingPair: MatchPair,
): string[] {
  assertTeamIds(teamIds);
  assertPair(teamIds, playingPair);

  const playingTeamIds = new Set(playingPair);
  return teamIds.filter((teamId) => !playingTeamIds.has(teamId));
}
