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

const getPicksInDraft = async (draftId: string) => {
  const response = await fetch(
    `https://api.sleeper.app/v1/draft/${draftId}/picks`
  );
  return await response.json();
};

const main = async () => {
  const user = await getUser("On2Cincinnati");
  // const leagues = await getLeagues(user.user_id, "2021");
  const drafts = await getDrafts(user.user_id, "2020");
  console.log({ drafts });
  const picks = await getPicksInDraft(drafts[0].draft_id);
  console.log({ picks });

  const playersStr = await Deno.readTextFile("./sleeper-players.json");
  const playersById = JSON.parse(playersStr);
  console.log(`Found ${Object.keys(playersById).length} sleeper players.`);
};

main();
