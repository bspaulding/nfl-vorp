import { FantasyDataPlayer } from "./vorp.ts";
import { fetchSeasonStats } from "./vorp-data.ts";

// Stat fields that flow into playerFantasyPoints(). These are the only fields
// we project; non-stat fields (Name, Team, etc.) come from the most recent season.
const STAT_FIELDS: Array<keyof FantasyDataPlayer> = [
  "PassingYards",
  "PassingTouchdowns",
  "TwoPointConversionPasses",
  "PassingInterceptions",
  "RushingYards",
  "RushingTouchdowns",
  "TwoPointConversionRuns",
  "ReceivingYards",
  "ReceivingTouchdowns",
  "Receptions",
  "TwoPointConversionReceptions",
  "FieldGoalsMade0to19",
  "FieldGoalsMade20to29",
  "FieldGoalsMade30to39",
  "FieldGoalsMade40to49",
  "FieldGoalsMade50Plus",
  "ExtraPointsMade",
  "ExtraPointsAttempted",
  "Fumbles",
];

type SeasonData = { season: number; stats: FantasyDataPlayer[] };

// Build projected stats from multiple historical seasons.
// historicalSeasons should be ordered oldest-to-newest.
// weights is a parallel array (must sum to 1.0).
// regressionWeight blends each player's projection toward their positional mean
// (useful for small samples or single-season outliers).
export function buildProjections(
  historicalSeasons: SeasonData[],
  weights: number[],
  projectedSeason: number,
  regressionWeight = 0.2
): FantasyDataPlayer[] {
  if (historicalSeasons.length !== weights.length) {
    throw new Error("historicalSeasons and weights must have the same length");
  }

  // Index each season's stats by PlayerID for fast lookup
  const byId: Map<number, Array<{ stats: FantasyDataPlayer; weight: number }>> =
    new Map();

  for (let i = 0; i < historicalSeasons.length; i++) {
    for (const player of historicalSeasons[i].stats) {
      if (!byId.has(player.PlayerID)) byId.set(player.PlayerID, []);
      byId.get(player.PlayerID)!.push({ stats: player, weight: weights[i] });
    }
  }

  // Build a map of the most recent record per player (for non-stat fields)
  const mostRecent = new Map<number, FantasyDataPlayer>();
  for (const season of historicalSeasons) {
    for (const player of season.stats) {
      mostRecent.set(player.PlayerID, player);
    }
  }

  // Compute per-player weighted projections
  const playerProjections: FantasyDataPlayer[] = [];
  for (const [playerId, appearances] of byId) {
    const latest = mostRecent.get(playerId)!;

    // Re-normalize weights to only the seasons this player appeared in
    const totalWeight = appearances.reduce((s, a) => s + a.weight, 0);
    const projected: Partial<FantasyDataPlayer> = {
      PlayerID: playerId,
      Season: projectedSeason,
      Team: latest.Team,
      Number: latest.Number,
      Name: latest.Name,
      Position: latest.Position,
      Played: 17, // project a full season
    };

    for (const field of STAT_FIELDS) {
      const weightedSum = appearances.reduce(
        (sum, a) => sum + ((a.stats[field] as number) ?? 0) * (a.weight / totalWeight),
        0
      );
      (projected as Record<string, unknown>)[field] = weightedSum;
    }

    playerProjections.push(projected as FantasyDataPlayer);
  }

  // Compute positional means across all projected players
  const positionalMeans = computePositionalMeans(playerProjections);

  // Blend each player's projection toward the positional mean
  return playerProjections.map((player) => {
    const means = positionalMeans.get(player.Position);
    if (!means) return player;
    const blended = { ...player };
    for (const field of STAT_FIELDS) {
      const playerVal = (player[field] as number) ?? 0;
      const meanVal = (means[field] as number) ?? 0;
      (blended as Record<string, unknown>)[field] =
        (1 - regressionWeight) * playerVal + regressionWeight * meanVal;
    }
    return blended;
  });
}

function computePositionalMeans(
  players: FantasyDataPlayer[]
): Map<string, Partial<FantasyDataPlayer>> {
  const byPosition = new Map<string, FantasyDataPlayer[]>();
  for (const p of players) {
    if (!byPosition.has(p.Position)) byPosition.set(p.Position, []);
    byPosition.get(p.Position)!.push(p);
  }

  const means = new Map<string, Partial<FantasyDataPlayer>>();
  for (const [pos, group] of byPosition) {
    const mean: Partial<FantasyDataPlayer> = {};
    for (const field of STAT_FIELDS) {
      const avg =
        group.reduce((s, p) => s + ((p[field] as number) ?? 0), 0) / group.length;
      (mean as Record<string, unknown>)[field] = avg;
    }
    means.set(pos, mean);
  }
  return means;
}

// Convenience: fetch the last `lookback` seasons and compute projections.
// For projecting 2025, pass targetSeason=2025 and it fetches 2022, 2023, 2024.
export async function fetchAndBuildProjections(
  targetSeason: number,
  lookbackSeasons = 3
): Promise<FantasyDataPlayer[]> {
  const seasons: number[] = [];
  for (let i = lookbackSeasons; i >= 1; i--) {
    seasons.push(targetSeason - i);
  }

  // Weight most recent season most heavily: [0.1, 0.3, 0.6] for 3 seasons
  const weights = computeExponentialWeights(seasons.length);

  // Fetch all seasons in parallel; skip seasons that fail (may not be on S3 yet)
  const results = await Promise.allSettled(
    seasons.map((s) => fetchSeasonStats(s).then((stats) => ({ season: s, stats })))
  );

  const historicalSeasons: SeasonData[] = [];
  const usedWeights: number[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      historicalSeasons.push((results[i] as PromiseFulfilledResult<SeasonData>).value);
      usedWeights.push(weights[i]);
    } else {
      console.warn(`Could not fetch season ${seasons[i]}, skipping.`);
    }
  }

  if (historicalSeasons.length === 0) {
    throw new Error("No historical seasons could be fetched — cannot build projections.");
  }

  // Re-normalize weights in case some seasons were skipped
  const weightSum = usedWeights.reduce((a, b) => a + b, 0);
  const normalizedWeights = usedWeights.map((w) => w / weightSum);

  return buildProjections(historicalSeasons, normalizedWeights, targetSeason);
}

// Returns weights that increase exponentially toward the most recent season,
// normalized to sum to 1.0. E.g. 3 seasons → [~0.1, ~0.3, ~0.6].
function computeExponentialWeights(n: number): number[] {
  const raw = Array.from({ length: n }, (_, i) => Math.pow(2, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}
