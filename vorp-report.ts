import { FantasyDataPlayer, PlayerWithVORP, calculatePlayerVORP } from "./vorp.ts";

export type PositionCurvePlayer = {
  rank: number;
  name: string;
  vorpRaw: number;
  vorpPerGame: number;
  pointsPerGame: number;
  isReplacement: boolean; // true for the first player at or below the replacement line
};

export type PositionCurve = {
  position: string;
  replacementValue: number;
  replacementPerGame: number;
  players: PositionCurvePlayer[];
  topVorp: number;       // rank-1 player's vorpRaw
  dropoffRate: number;   // average VORP lost per rank step across the starter tier
  scarcityScore: number; // topVorp / dropoffRate — higher means steeper cliff
};

export type VorpCurveReport = {
  season: number;
  leagueSize: number;
  positions: PositionCurve[];
  summary: Array<{
    position: string;
    top1Vorp: number;
    top5AvgVorp: number;
    dropoffRate: number;
    scarcityScore: number;
    replacementPerGame: number;
  }>;
};

const POSITIONS = ["QB", "RB", "WR", "TE", "K"];

export function buildVorpCurveReport(
  allPlayers: PlayerWithVORP[],
  playerStats: FantasyDataPlayer[],
  season: number,
  leagueSize: number
): VorpCurveReport {
  const positions: PositionCurve[] = POSITIONS.map((pos) => {
    const { players, replacementValue, replacementPerGame } = calculatePlayerVORP(
      playerStats,
      pos,
      leagueSize
    );

    const curvePlayers: PositionCurvePlayer[] = players.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      vorpRaw: p.vorpRaw,
      vorpPerGame: p.vorpPerGame,
      pointsPerGame: p.points.perGame,
      isReplacement: p.vorpRaw <= 0 && (i === 0 || players[i - 1].vorpRaw > 0),
    }));

    const topVorp = curvePlayers[0]?.vorpRaw ?? 0;
    // Measure drop-off over the starter tier (top leagueSize * starterSlots players)
    const starterTierSize = Math.min(
      Math.round(leagueSize * 2),
      curvePlayers.length - 1
    );
    const dropoffRate =
      starterTierSize > 0
        ? (curvePlayers[0]?.vorpRaw - curvePlayers[starterTierSize]?.vorpRaw) /
          starterTierSize
        : 0;
    const scarcityScore = dropoffRate > 0 ? topVorp / dropoffRate : 0;

    return {
      position: pos,
      replacementValue,
      replacementPerGame,
      players: curvePlayers,
      topVorp,
      dropoffRate,
      scarcityScore,
    };
  });

  const summary = positions.map((c) => {
    const top5 = c.players.slice(0, 5);
    const top5AvgVorp =
      top5.length > 0
        ? top5.reduce((s, p) => s + p.vorpRaw, 0) / top5.length
        : 0;
    return {
      position: c.position,
      top1Vorp: c.topVorp,
      top5AvgVorp,
      dropoffRate: c.dropoffRate,
      scarcityScore: c.scarcityScore,
      replacementPerGame: c.replacementPerGame,
    };
  });

  return { season, leagueSize, positions, summary };
}

// ── Text report ──────────────────────────────────────────────────────────────

export function generateTextReport(report: VorpCurveReport): string {
  const lines: string[] = [];
  const LINE = "=".repeat(70);
  const line = "-".repeat(70);

  lines.push(`VORP Curve Report — ${report.season} Season (${report.leagueSize}-team league)`);
  lines.push(LINE);
  lines.push("");
  lines.push(
    "Position  Top VORP  Top5 Avg  Drop/Rank  Scarcity  Repl (pts/gm)"
  );
  lines.push(line);

  const sorted = [...report.summary].sort(
    (a, b) => b.scarcityScore - a.scarcityScore
  );
  for (const s of sorted) {
    lines.push(
      `${s.position.padEnd(10)}` +
        `${s.top1Vorp.toFixed(1).padStart(8)}  ` +
        `${s.top5AvgVorp.toFixed(1).padStart(8)}  ` +
        `${s.dropoffRate.toFixed(2).padStart(9)}  ` +
        `${s.scarcityScore.toFixed(1).padStart(8)}  ` +
        `${s.replacementPerGame.toFixed(1).padStart(13)}`
    );
  }

  lines.push("");
  lines.push(
    "* Scarcity score = Top VORP ÷ avg drop per rank. Higher = draft earlier."
  );
  lines.push("");

  for (const curve of report.positions) {
    lines.push(`${curve.position} — Top 12 (replacement line at ${curve.replacementPerGame.toFixed(1)} pts/gm)`);
    lines.push(line);
    for (const p of curve.players.slice(0, 12)) {
      const marker = p.isReplacement ? " ← REPLACEMENT" : "";
      lines.push(
        `  ${String(p.rank).padStart(2)}. ${p.name.padEnd(24)} ` +
          `VORP: ${p.vorpRaw.toFixed(1).padStart(7)}  ` +
          `${p.vorpPerGame.toFixed(2).padStart(5)}/gm${marker}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── HTML report ───────────────────────────────────────────────────────────────

export function generateHTMLReport(report: VorpCurveReport): string {
  const colors: Record<string, string> = {
    QB: "#4e79a7",
    RB: "#f28e2b",
    WR: "#59a14f",
    TE: "#e15759",
    K: "#b07aa1",
  };

  // Build datasets for the combined chart (all positions, rank vs vorpPerGame)
  const datasets = report.positions.map((curve) => ({
    label: curve.position,
    data: curve.players
      .filter((p) => p.rank <= 36)
      .map((p) => ({ x: p.rank, y: parseFloat(p.vorpPerGame.toFixed(2)) })),
    borderColor: colors[curve.position] ?? "#999",
    backgroundColor: "transparent",
    tension: 0.3,
    pointRadius: 2,
  }));

  // Replacement level annotations (as horizontal lines via a separate dataset)
  const replacementDatasets = report.positions.map((curve) => ({
    label: `${curve.position} repl.`,
    data: [
      { x: 1, y: parseFloat(curve.replacementPerGame.toFixed(2)) },
      { x: 36, y: parseFloat(curve.replacementPerGame.toFixed(2)) },
    ],
    borderColor: colors[curve.position] ?? "#999",
    backgroundColor: "transparent",
    borderDash: [4, 4],
    borderWidth: 1,
    pointRadius: 0,
  }));

  const allDatasets = [...datasets, ...replacementDatasets];

  const summaryRows = [...report.summary]
    .sort((a, b) => b.scarcityScore - a.scarcityScore)
    .map(
      (s) =>
        `<tr>
          <td style="color:${colors[s.position]};font-weight:bold">${s.position}</td>
          <td>${s.top1Vorp.toFixed(1)}</td>
          <td>${s.top5AvgVorp.toFixed(1)}</td>
          <td>${s.dropoffRate.toFixed(2)}</td>
          <td>${s.scarcityScore.toFixed(1)}</td>
          <td>${s.replacementPerGame.toFixed(1)}</td>
        </tr>`
    )
    .join("\n");

  const positionTables = report.positions
    .map((curve) => {
      const rows = curve.players
        .slice(0, 20)
        .map(
          (p) =>
            `<tr${p.isReplacement ? ' class="replacement"' : ""}>
              <td>${p.rank}</td>
              <td>${p.name}</td>
              <td>${p.vorpRaw.toFixed(1)}</td>
              <td>${p.vorpPerGame.toFixed(2)}</td>
              <td>${p.pointsPerGame.toFixed(1)}</td>
            </tr>`
        )
        .join("\n");
      return `
        <h3 style="color:${colors[curve.position]}">${curve.position}</h3>
        <p>Replacement level: ${curve.replacementPerGame.toFixed(1)} pts/gm
           &nbsp;|&nbsp; Scarcity score: ${curve.scarcityScore.toFixed(1)}</p>
        <table>
          <thead><tr><th>#</th><th>Player</th><th>VORP</th><th>VORP/gm</th><th>Pts/gm</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>VORP Curve Report — ${report.season}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  h1 { border-bottom: 2px solid #ddd; padding-bottom: .5rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; font-size: .9rem; }
  th, td { text-align: left; padding: .35rem .75rem; border-bottom: 1px solid #eee; }
  th { background: #f5f5f5; }
  tr.replacement { background: #fff3cd; font-style: italic; }
  canvas { margin-bottom: 2rem; }
  .note { color: #888; font-size: .85rem; }
</style>
</head>
<body>
<h1>VORP Curve Report &mdash; ${report.season} Season (${report.leagueSize}-team league)</h1>

<h2>Positional Scarcity Summary</h2>
<p class="note">Sorted by scarcity score (higher = draft earlier). Dashed lines on chart mark each position's replacement level.</p>
<table>
  <thead>
    <tr><th>Position</th><th>Top VORP</th><th>Top 5 Avg</th><th>Drop/Rank</th><th>Scarcity</th><th>Repl (pts/gm)</th></tr>
  </thead>
  <tbody>${summaryRows}</tbody>
</table>

<h2>VORP Curves by Position (rank vs. VORP/gm)</h2>
<canvas id="chart" height="400"></canvas>
<script>
  new Chart(document.getElementById("chart"), {
    type: "line",
    data: { datasets: ${JSON.stringify(allDatasets)} },
    options: {
      scales: {
        x: { type: "linear", title: { display: true, text: "Player Rank" } },
        y: { title: { display: true, text: "VORP per game" } }
      },
      plugins: { legend: { position: "top" } }
    }
  });
</script>

<h2>Player Rankings by Position (top 20)</h2>
${positionTables}
</body>
</html>`;
}
