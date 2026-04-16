import { PlayerWithVORP } from "./vorp.ts";

export type TradeSide = {
  players: PlayerWithVORP[];
  totalVorpRaw: number;
  totalVorpPerGame: number;
};

export type TradeEvaluation = {
  giving: TradeSide;
  receiving: TradeSide;
  netVorpRaw: number;      // positive = you win the trade
  netVorpPerGame: number;
  verdict: string;
};

// Case-insensitive substring match. Returns the best (shortest-name) match
// so "Hill" finds "Tyreek Hill" rather than a longer spurious match.
// Throws a descriptive error if no match is found.
export function findPlayer(
  query: string,
  players: PlayerWithVORP[]
): PlayerWithVORP {
  const q = query.toLowerCase().trim();
  const matches = players.filter((p) => p.name.toLowerCase().includes(q));
  if (matches.length === 0) {
    // Suggest close names to help with typos
    const suggestions = players
      .map((p) => ({ name: p.name, score: levenshtein(q, p.name.toLowerCase()) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((s) => s.name);
    throw new Error(
      `No player found matching "${query}". Did you mean: ${suggestions.join(", ")}?`
    );
  }
  // Prefer exact match, then shortest name (most specific)
  const exact = matches.find((p) => p.name.toLowerCase() === q);
  return exact ?? matches.sort((a, b) => a.name.length - b.name.length)[0];
}

export function evaluateTrade(
  givingNames: string[],
  receivingNames: string[],
  allVorpData: PlayerWithVORP[]
): TradeEvaluation {
  const givingPlayers = givingNames.map((name) => findPlayer(name, allVorpData));
  const receivingPlayers = receivingNames.map((name) =>
    findPlayer(name, allVorpData)
  );

  const giving = summarizeSide(givingPlayers);
  const receiving = summarizeSide(receivingPlayers);

  const netVorpRaw = receiving.totalVorpRaw - giving.totalVorpRaw;
  const netVorpPerGame = receiving.totalVorpPerGame - giving.totalVorpPerGame;

  const verdict = tradeVerdict(netVorpPerGame);

  return { giving, receiving, netVorpRaw, netVorpPerGame, verdict };
}

function summarizeSide(players: PlayerWithVORP[]): TradeSide {
  return {
    players,
    totalVorpRaw: players.reduce((s, p) => s + p.vorpRaw, 0),
    totalVorpPerGame: players.reduce((s, p) => s + p.vorpPerGame, 0),
  };
}

function tradeVerdict(netVorpPerGame: number): string {
  if (netVorpPerGame > 3) return "Strong win";
  if (netVorpPerGame > 1) return "Win";
  if (netVorpPerGame > -1) return "Roughly even";
  if (netVorpPerGame > -3) return "Loss";
  return "Strong loss";
}

// Simple Levenshtein distance for typo suggestions
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
