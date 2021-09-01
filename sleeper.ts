import { playersWithVorpByPlayerId } from "./vorp.ts";

const getUser = async (username: string) => {
  const response = await fetch(`https://api.sleeper.app/v1/user/${username}`);
  return await response.json();
};

const getLeagues = async (userId: string, season: string) => {
  const response = await fetch(
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`
  );
  if (response.ok) {
    return await response.json();
  } else {
    console.error(response);
    throw new Error("Got bad response getting leagues");
  }
};

const getDrafts = async (userId: string, season: string) => {
  const response = await fetch(
    `https://api.sleeper.app/v1/user/${userId}/drafts/nfl/${season}`
  );
  return await response.json();
};

const getPicksInDraft = async (draftId: string): Promise<DraftPick[]> => {
  const response = await fetch(
    `https://api.sleeper.app/v1/draft/${draftId}/picks`
  );
  return await response.json();
};

type PlayerId = string;
type DraftPickMetadata = {
  player_id: string;
  first_name: string;
  last_name: string;
  number: string;
};
interface DraftPick {
  round: number;
  roster_id: number;
  player_id: PlayerId;
  pick_no: number;
  metadata: DraftPickMetadata;
}
interface DraftPickWithVorp extends DraftPick {
  fantasyDataId: number;
  vorpPerGame: number;
  vorpRaw: number;
}
type SleeperPlayer = {
  fantasy_data_id: number;
  full_name: string;
  player_id: string;
  position: string;
  number: number;
};
type SleeperPlayersById = { [key: string]: SleeperPlayer };
const main = async () => {
  const playersStr = await Deno.readTextFile("./sleeper-players.json");
  const playersById: SleeperPlayersById = JSON.parse(playersStr);

  const user = await getUser("On2Cincinnati");
  // const leagues = await getLeagues(user.user_id, "2021");
  const drafts = await getDrafts(user.user_id, "2020");
  console.log({ drafts });
  const picks = await getPicksInDraft(drafts[0].draft_id);

  const vorpById = playersWithVorpByPlayerId();
  const picksWithVorp: DraftPickWithVorp[] = picks.map((pick) => ({
    ...pick,
    fantasyDataId: playersById[pick.player_id].fantasy_data_id,
    vorpPerGame:
      vorpById[playersById[pick.player_id].fantasy_data_id]?.vorpPerGame,
    vorpRaw: vorpById[playersById[pick.player_id].fantasy_data_id]?.vorpRaw,
  }));
  const outStr = picksWithVorp
    .map(
      (pick) =>
        `${pick.pick_no}. ${pick.metadata.first_name} ${
          pick.metadata.last_name
        }\t${(pick.vorpPerGame || 0).toFixed(2)}`
    )
    .join("\n");
  console.log("Pick No.\tVORP Per Game\n", outStr);
};

main();
