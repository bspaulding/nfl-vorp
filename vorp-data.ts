import { FantasyDataPlayer } from "./vorp.ts";

const DATA_HOST = "nfl-stats.motingo.com.s3-website-us-east-1.amazonaws.com";

export async function fetchSeasonStats(
  season: number
): Promise<FantasyDataPlayer[]> {
  const url = `http://${DATA_HOST}/api/players/${season}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch season ${season}: ${await res.text()}`);
  }
  return res.json();
}

// Simple in-memory cache keyed by season, TTL 5 minutes.
// Avoids re-fetching from S3 on every request during a draft/trade session.
type CacheEntry = { data: FantasyDataPlayer[]; ts: number };
const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchSeasonStatsCached(
  season: number
): Promise<FantasyDataPlayer[]> {
  const entry = cache.get(season);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
    return entry.data;
  }
  const data = await fetchSeasonStats(season);
  cache.set(season, { data, ts: Date.now() });
  return data;
}
