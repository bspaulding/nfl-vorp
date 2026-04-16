import { allPlayersWithVorp } from "./vorp.ts";
import { generateCSV } from "./vorp-csv.ts";
import { fetchAndBuildProjections } from "./vorp-projections.ts";

const targetSeason = Deno.args[0] ? parseInt(Deno.args[0], 10) : new Date().getFullYear() + 1;
const leagueSize = Deno.args[1] ? parseInt(Deno.args[1], 10) : 12;
const outfile = `projections-${targetSeason}.csv`;

console.log(`Building projected stats for ${targetSeason} season (${leagueSize}-team league)...`);
const projections = await fetchAndBuildProjections(targetSeason);
console.log(`Projected ${projections.length} players.`);

const vorpData = allPlayersWithVorp(projections, leagueSize);

const positions = ["QB", "RB", "WR", "TE", "K"];
for (const pos of positions) {
  const players = vorpData
    .filter((p) => p.meta.player.Position === pos)
    .slice(0, 5);
  console.log(`\nTop 5 projected ${pos}s:`);
  for (const [i, p] of players.entries()) {
    console.log(
      `  ${i + 1}. ${p.name}: ${p.vorpPerGame.toFixed(1)} VORP/gm, ${p.points.perGame.toFixed(1)} pts/gm`
    );
  }
}

await Deno.writeTextFile(outfile, generateCSV(vorpData));
console.log(`\nWrote projected VORP to ${outfile}`);
