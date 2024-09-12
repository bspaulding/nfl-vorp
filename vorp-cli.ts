import { allPlayersWithVorp, calculatePlayerVORP } from "./vorp.ts";
import { generateCSV } from "./vorp-csv.ts";

const file = Deno.args[0];
console.log(`Reading stats from ${file}`);
const playerStats = JSON.parse(await Deno.readTextFile(file));

const outfile = "out.csv";
console.log(`Writing vorp to ${outfile}`);
writeCSV(outfile);

function writeCSV(fileName: string) {
  const data = allPlayersWithVorp(playerStats);
  Deno.writeTextFile(fileName, generateCSV(data));
}

function printTop10(position: string) {
  const { players, replacementValue, replacementPerGame } = calculatePlayerVORP(
    playerStats,
    position
  );

  console.log(`-------------------------------------------`);
  console.log(`Top 10 ${position}s (of ${players.length}) `);
  console.log(
    `  Replacement Value: ${replacementPerGame}pts per game,  ${Math.round(
      replacementValue
    )}pts total`
  );
  console.log(`-------------------------------------------`);
  console.log(
    players
      .slice(0, 12)
      .map(
        (r, i) =>
          `${i + 1}. ${r.name}: ${Math.round(
            r.points.perGame - replacementPerGame
          )}pt VORP. ${Math.round(r.points.perGame)}pts per game, ${Math.round(
            r.points.total
          )}pts total.`
      )
      .join("\n")
  );
}

printTop10("QB");
printTop10("RB");
printTop10("WR");
printTop10("TE");
printTop10("K");
