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

export function generateCSV(data) {
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

  const dataStr = data
    .map(playerToRow)
    .map((r) => r.join(", "))
    .join("\n");
  return [header.join(", "), dataStr].join("\n");
}
