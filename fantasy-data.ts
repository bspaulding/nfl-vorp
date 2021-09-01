export async function getPlayerSeasonStats(season: string) {
  const response = await fetch(
    `https://api.sportsdata.io/api/nfl/fantasy/json/PlayerSeasonStats/${season}`
  );
  return await response.json();
}

async function main() {
  const players2019 = await getPlayerSeasonStats("2019REG");
  console.log(players2019);
}

main();
