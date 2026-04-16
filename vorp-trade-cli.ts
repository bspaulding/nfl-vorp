import { allPlayersWithVorp } from "./vorp.ts";
import { fetchSeasonStatsCached } from "./vorp-data.ts";
import { evaluateTrade, findPlayer } from "./vorp-trade.ts";

// Parse --key=value flags from args
function parseArgs(args: string[]) {
  const result: Record<string, string> = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

const flags = parseArgs(Deno.args);
const season = flags["season"] ? parseInt(flags["season"], 10) : 2024;
const leagueSize = flags["league-size"] ? parseInt(flags["league-size"], 10) : 12;
const giveArg = flags["give"];
const receiveArg = flags["receive"];

if (!giveArg || !receiveArg) {
  console.error(
    "Usage: deno run --allow-net vorp-trade-cli.ts --season=2024 --give=\"Player A\" --receive=\"Player B,Player C\""
  );
  Deno.exit(1);
}

const givingNames = giveArg.split(",").map((s) => s.trim());
const receivingNames = receiveArg.split(",").map((s) => s.trim());

console.log(`Fetching ${season} season VORP data...`);
const playerStats = await fetchSeasonStatsCached(season);
const vorpData = allPlayersWithVorp(playerStats, leagueSize);

const result = evaluateTrade(givingNames, receivingNames, vorpData);

const LINE = "=".repeat(50);
const line = "-".repeat(50);

console.log(`\nTrade Evaluation — ${season} Season (${leagueSize}-team league)`);
console.log(LINE);

console.log("\nGIVING UP:");
for (const p of result.giving.players) {
  const pos = p.meta.player.Position.padEnd(3);
  console.log(
    `  ${p.name} (${pos})  VORP: ${p.vorpRaw.toFixed(1)} raw / ${p.vorpPerGame.toFixed(2)}/gm`
  );
}
console.log(line);
console.log(
  `  Total:  ${result.giving.totalVorpRaw.toFixed(1)} raw / ${result.giving.totalVorpPerGame.toFixed(2)}/gm`
);

console.log("\nRECEIVING:");
for (const p of result.receiving.players) {
  const pos = p.meta.player.Position.padEnd(3);
  console.log(
    `  ${p.name} (${pos})  VORP: ${p.vorpRaw.toFixed(1)} raw / ${p.vorpPerGame.toFixed(2)}/gm`
  );
}
console.log(line);
console.log(
  `  Total:  ${result.receiving.totalVorpRaw.toFixed(1)} raw / ${result.receiving.totalVorpPerGame.toFixed(2)}/gm`
);

const sign = result.netVorpPerGame >= 0 ? "+" : "";
console.log(`\nNET VORP: ${sign}${result.netVorpRaw.toFixed(1)} raw  /  ${sign}${result.netVorpPerGame.toFixed(2)}/gm`);
console.log(`VERDICT:  ${result.verdict}`);
console.log();
