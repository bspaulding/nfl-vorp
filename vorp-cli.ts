import { allPlayersWithVorp, calculatePlayerVORP } from "./vorp.ts";

const file = Deno.args[0];
console.log(`Reading stats from ${file}`);
const playerStats = JSON.parse(await Deno.readTextFile(file));

const outfile = "out.csv";
console.log(`Writing vorp to ${outfile}`);
writeCSV(outfile);

function writeCSV(fileName: string) {
  Deno.writeTextFile(fileName, generateCSV());
}

function playerToRow(playerData: PlayerWithVORP) {
  const p = playerData.meta.player;
  return [
    p.Name,
    p.Team,
    p.Position,
    p.Season,
    playerData.vorpRaw,
    playerData.vorpPerGame,
    playerData.points.total,
    playerData.points.perGame,
  ];
}

function generateCSV() {
  const header = [
    "Name",
    "Team",
    "Position",
    "Season",
    "VORP Raw",
    "VORP Per Game",
    "Points Total",
    "Points Per Game",
  ];

  const dataStr = allPlayersWithVorp(playerStats)
    .map(playerToRow)
    .map((r) => r.join(", "))
    .join("\n");
  return [header.join(", "), dataStr].join("\n");
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
