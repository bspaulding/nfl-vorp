const scoring = {
  passing: {
    pointsPerYard: 1 / 25,
    touchdown: 4,
    twoPointConversion: 2,
    interception: -1,
  },
  rushing: {
    pointsPerYard: 1 / 10,
    touchdown: 6,
    twoPointConversion: 2,
  },
  receiving: {
    reception: 1,
    pointsPerYard: 1 / 10,
    touchdown: 6,
    twoPointConversion: 2,
  },
  kicking: {
    fgMadeYards0to19: 3,
    fgMadeYards20to29: 3,
    fgMadeYards30to39: 3,
    fgMadeYards40to49: 4,
    fgMadeYards50Plus: 5,
    patMade: 1,
    patMiss: -1,
  },
  defense: {
    touchdown: 6,
    pointsAllowed0: 10,
    pointsAllowed1to6: 7,
    pointsAllowed7to13: 4,
    pointsAllowed14to20: 1,
    pointsAllowed28to34: -1,
    pointsAllowed35Plus: -4,
    sack: 1,
    interception: 2,
    fumbleRecovery: 2,
    safety: 2,
    forcedFumble: 1,
    blockedKick: 2,
    // special teams defense - this included?
    specialTeamsTouchdown: 6,
    specialTeamsForcedFumble: 1,
    specialTeamsFumbleRecovery: 1,
  },
  specialTeamsPlayer: {
    touchdown: 6,
    forcedFumble: 1,
    fumbleRecovery: 1,
  },
  general: {
    fumble: -1,
    fumbleLost: -1,
    fumbleRecoveryTouchdown: 6,
  },
};

type FantasyDataPlayer = {
  PlayerID: number;
  Season: number;
  Team: string;
  Number: number;
  Name: string;
  Position: string;
  Played: number;
  PassingYards: number;
  PassingTouchdowns: number;
  TwoPointConversionPasses: number;
  PassingInterceptions: number;
  RushingYards: number;
  RushingTouchdowns: number;
  TwoPointConversionRuns: number;
  ReceivingYards: number;
  ReceivingTouchdowns: number;
  Receptions: number;
  TwoPointConversionReceptions: number;
  FieldGoalsMade0to19: number;
  FieldGoalsMade20to29: number;
  FieldGoalsMade30to39: number;
  FieldGoalsMade40to49: number;
  FieldGoalsMade50Plus: number;
  ExtraPointsMade: number;
  ExtraPointsAttempted: number;
};
function playerFantasyPoints(player: FantasyDataPlayer): FantasyPoints {
  const passing =
    player.PassingYards * scoring.passing.pointsPerYard +
    player.PassingTouchdowns * scoring.passing.touchdown +
    player.TwoPointConversionPasses * scoring.passing.twoPointConversion +
    player.PassingInterceptions * scoring.passing.interception;

  const rushing =
    scoring.rushing.pointsPerYard * player.RushingYards +
    scoring.rushing.touchdown * player.RushingTouchdowns +
    scoring.rushing.twoPointConversion * player.TwoPointConversionRuns;

  const receiving =
    scoring.receiving.pointsPerYard * player.ReceivingYards +
    scoring.receiving.touchdown * player.ReceivingTouchdowns +
    scoring.receiving.reception * player.Receptions +
    scoring.receiving.twoPointConversion * player.TwoPointConversionReceptions;

  const kicking =
    scoring.kicking.fgMadeYards0to19 * player.FieldGoalsMade0to19 +
    scoring.kicking.fgMadeYards20to29 * player.FieldGoalsMade20to29 +
    scoring.kicking.fgMadeYards30to39 * player.FieldGoalsMade30to39 +
    scoring.kicking.fgMadeYards40to49 * player.FieldGoalsMade40to49 +
    scoring.kicking.fgMadeYards50Plus * player.FieldGoalsMade50Plus +
    scoring.kicking.patMade * player.ExtraPointsMade +
    scoring.kicking.patMiss *
      (player.ExtraPointsAttempted - player.ExtraPointsMade);

  // TODO: defense
  const defense = 0;

  // TODO: specialTeamsPlayer
  const specialTeamsPlayer = 0;

  // TODO: general
  const general = 0;

  const total =
    passing +
    rushing +
    receiving +
    kicking +
    defense +
    specialTeamsPlayer +
    general;
  const perGame = player.Played === 0 ? 0 : total / player.Played;
  return {
    total,
    perGame,
    passing,
    rushing,
    receiving,
    kicking,
    defense,
    specialTeamsPlayer,
    general,
  };
}

interface FantasyPoints {
  total: number;
  perGame: number;
  passing: number;
  rushing: number;
  receiving: number;
  kicking: number;
  defense: number;
  specialTeamsPlayer: number;
  general: number;
}

interface PlayerWithScore {
  name: string;
  points: FantasyPoints;
  meta: { player: FantasyDataPlayer };
}
function sortByPoints(players: FantasyDataPlayer[]): PlayerWithScore[] {
  return players
    .map((p) => ({
      name: p.Name,
      points: playerFantasyPoints(p),
      meta: { player: p },
    }))
    .sort((a, b) => b.points.total - a.points.total);
}

function median(xs: number[]) {
  const pivot = Math.floor(xs.length / 2);
  if (xs.length % 2 === 0) {
    return (xs[pivot] + xs[pivot - 1]) / 2;
  } else {
    return xs[pivot];
  }
}

function mean(xs: number[]) {
  return xs.reduce((x, y) => x + y, 0) / xs.length;
}

const leagueSize = 12;
function replacementPlayerValue(players: FantasyDataPlayer[]) {
  const sorted = sortByPoints(players);
  // use average points
  // result: terrible, too much junk at the bottom
  // return sorted.map(p => p.points.total).reduce((x, y) => x + y, 0) / sorted.length;

  // use the median of some multiples of the league size, excluding starters
  // result: seems okish? differences are not as pronounced as point totals would indicate
  // return median(sorted.slice(leagueSize, leagueSize * 2).map(p => p.points.total))

  // some multiples of the league size, excluding starters
  // 👆🏻 used this for 2020, realized that this slice of replacement players should probably
  // be different per position?
  const position = players[0].Position;
  const replacementPlayers = sorted.slice(leagueSize, leagueSize * 2);

  // use the mean of replacement players totals
  return mean(replacementPlayers.map((p) => p.points.total));
}

interface PlayerWithVORP extends PlayerWithScore {
  vorpRaw: number;
  vorpPerGame: number;
}
type VorpResult = {
  players: PlayerWithVORP[];
  replacementValue: number;
  replacementPerGame: number;
};

function playerWithVorp(replacementValue: number, replacementPerGame: number) {
  return function (p: PlayerWithScore): PlayerWithVORP {
    return {
      ...p,
      vorpRaw: p.points.total - replacementValue,
      vorpPerGame: p.points.perGame - replacementPerGame,
    };
  };
}

export function calculatePlayerVORP(
  playerStats: FantasyDataPlayer[],
  position: string
): VorpResult {
  const players = playerStats.filter((p) => p.Position === position);
  const replacementValue = replacementPlayerValue(players);
  // TODO: is 16 the right number of games?
  const replacementPerGame = Math.round(replacementValue / 16);
  return {
    players: sortByPoints(players).map(
      playerWithVorp(replacementValue, replacementPerGame)
    ),
    replacementValue,
    replacementPerGame,
  };
}

export function allPlayersWithVorp(playerStats): PlayerWithVORP[] {
  const { players: qbs } = calculatePlayerVORP(playerStats, "QB");
  const { players: rbs } = calculatePlayerVORP(playerStats, "RB");
  const { players: wrs } = calculatePlayerVORP(playerStats, "WR");
  const { players: tes } = calculatePlayerVORP(playerStats, "TE");
  const { players: ks } = calculatePlayerVORP(playerStats, "K");
  return [...qbs, ...rbs, ...wrs, ...tes, ...ks];
}

interface PlayersWithVORPById {
  [key: string]: PlayerWithVORP;
}

export function playersWithVorpByPlayerId(): PlayersWithVORPById {
  return allPlayersWithVorp().reduce(
    (acc, p) => ({
      ...acc,
      [p.meta.player.PlayerID]: p,
    }),
    {}
  );
}
