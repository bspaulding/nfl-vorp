import { allPlayersWithVorp } from "./vorp.ts";
import { fetchSeasonStatsCached } from "./vorp-data.ts";
import {
  buildVorpCurveReport,
  generateHTMLReport,
  generateTextReport,
} from "./vorp-report.ts";

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
const format = (flags["format"] ?? "html") as "html" | "text";
const defaultOut = format === "html" ? `vorp-report-${season}.html` : null;
const outfile = flags["out"] ?? defaultOut;

console.log(`Fetching ${season} season data...`);
const playerStats = await fetchSeasonStatsCached(season);
const vorpData = allPlayersWithVorp(playerStats, leagueSize);

const report = buildVorpCurveReport(vorpData, playerStats, season, leagueSize);

if (format === "text") {
  const text = generateTextReport(report);
  if (outfile) {
    await Deno.writeTextFile(outfile, text);
    console.log(`Wrote text report to ${outfile}`);
  } else {
    console.log(text);
  }
} else {
  const html = generateHTMLReport(report);
  const dest = outfile!;
  await Deno.writeTextFile(dest, html);
  console.log(`Wrote HTML report to ${dest}`);
  console.log(`Open in a browser: file://${await Deno.realPath(dest)}`);
}
