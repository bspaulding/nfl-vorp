import { PlayerWithVORP } from "./vorp.ts";

const SLEEPER_API = "https://api.sleeper.app/v1";
const SCORABLE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

// ── Types ────────────────────────────────────────────────────────────────────

export type SleeperPlayer = {
  player_id: string;
  full_name: string;
  fantasy_data_id: number;
  position: string;
  team: string | null;
};

export type SleeperPick = {
  pick_no: number;
  round: number;
  roster_id: number;
  player_id: string;
  metadata: {
    first_name: string;
    last_name: string;
    position: string;
  };
};

export type DraftedPlayer = {
  pickNo: number;
  playerName: string;
  position: string;
  fantasyDataId: number;
};

export type DraftState = {
  drafted: Set<number>;      // FantasyData player IDs
  picks: DraftedPlayer[];    // ordered log for display
};

// ── Draft state ───────────────────────────────────────────────────────────────

export function createDraftState(): DraftState {
  return { drafted: new Set(), picks: [] };
}

// Returns true if the pick was newly added, false if already tracked.
export function markDrafted(
  state: DraftState,
  fantasyDataId: number,
  meta: { pickNo?: number; playerName?: string; position?: string } = {}
): boolean {
  if (state.drafted.has(fantasyDataId)) return false;
  state.drafted.add(fantasyDataId);
  state.picks.push({
    pickNo: meta.pickNo ?? state.picks.length + 1,
    playerName: meta.playerName ?? "Unknown",
    position: meta.position ?? "?",
    fantasyDataId,
  });
  return true;
}

export function undoLastPick(state: DraftState): DraftedPlayer | null {
  const last = state.picks.pop() ?? null;
  if (last) state.drafted.delete(last.fantasyDataId);
  return last;
}

// Returns available players sorted by vorpPerGame descending.
export function getAvailable(
  state: DraftState,
  projectedVorp: PlayerWithVORP[],
  options: { position?: string; topN?: number } = {}
): PlayerWithVORP[] {
  let pool = projectedVorp.filter(
    (p) =>
      !state.drafted.has(p.meta.player.PlayerID) &&
      SCORABLE_POSITIONS.has(p.meta.player.Position)
  );
  if (options.position) {
    const pos = options.position.toUpperCase();
    pool = pool.filter((p) => p.meta.player.Position === pos);
  }
  pool.sort((a, b) => b.vorpPerGame - a.vorpPerGame);
  return options.topN ? pool.slice(0, options.topN) : pool;
}

// ── Sleeper API ───────────────────────────────────────────────────────────────

// Fetches the full Sleeper NFL player list, keyed by Sleeper player_id.
// Used at draft startup to map Sleeper IDs → FantasyData IDs.
// Note: this is ~7MB — call once and cache the result.
export async function fetchSleeperPlayerMap(): Promise<
  Record<string, SleeperPlayer>
> {
  const res = await fetch(`${SLEEPER_API}/players/nfl`);
  if (!res.ok) {
    throw new Error(`Sleeper /players/nfl failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSleeperDraftPicks(
  draftId: string
): Promise<SleeperPick[]> {
  const res = await fetch(`${SLEEPER_API}/draft/${draftId}/picks`);
  if (!res.ok) {
    throw new Error(`Sleeper /draft/${draftId}/picks failed: ${res.status}`);
  }
  return res.json();
}

// Case-insensitive substring match against available players.
// Returns the best match (shortest name wins on ties, to prefer exact matches).
// Returns null if nothing matches.
export function findByName(
  query: string,
  players: PlayerWithVORP[]
): PlayerWithVORP | null {
  const q = query.toLowerCase().trim();
  const matches = players.filter((p) => p.name.toLowerCase().includes(q));
  if (matches.length === 0) return null;
  const exact = matches.find((p) => p.name.toLowerCase() === q);
  return exact ?? matches.sort((a, b) => a.name.length - b.name.length)[0];
}

// Applies a fresh set of Sleeper picks to the draft state.
// Skips picks already tracked and non-scorable positions (DL, DB, etc.).
// Returns the number of newly added picks.
export function applySleeperPicks(
  state: DraftState,
  picks: SleeperPick[],
  playerMap: Record<string, SleeperPlayer>
): number {
  let added = 0;
  for (const pick of picks) {
    const sp = playerMap[pick.player_id];
    if (!sp?.fantasy_data_id) continue;
    if (!SCORABLE_POSITIONS.has(sp.position)) continue;
    const name =
      sp.full_name ??
      `${pick.metadata.first_name} ${pick.metadata.last_name}`.trim();
    const isNew = markDrafted(state, sp.fantasy_data_id, {
      pickNo: pick.pick_no,
      playerName: name,
      position: sp.position,
    });
    if (isNew) added++;
  }
  return added;
}
