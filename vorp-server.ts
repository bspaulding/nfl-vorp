import { allPlayersWithVorp } from "./vorp.ts";
import { generateCSV } from "./vorp-csv.ts";

const dataHost = "nfl-stats.motingo.com.s3-website-us-east-1.amazonaws.com";

type Result = { value: object; error: string };

function mapResult(fn, { value, error }) {
  if (error || !value) {
    return { value, error };
  } else {
    return fn(value);
  }
}

async function getVorpForSeason(season: int): Result {
  const playerStatsUrl = `http://${dataHost}/api/players/2024.json`;
  const playerStatsResponse = await fetch(playerStatsUrl);
  if (playerStatsResponse.ok) {
    const playerStats = await playerStatsResponse.json();
    return { value: allPlayersWithVorp(playerStats) };
  } else {
    return { error: await playerStatsResponse.text() };
  }
}

function handleResultJSON({ value, error }: Result) {
  if (error || !value) {
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    return new Response(JSON.stringify(value), {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
    });
  }
}

function handleResultText(
  { value, error }: Result,
  contentType: str = "text/html"
) {
  if (error || !value) {
    return new Response(error, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  } else {
    return new Response(value, {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": contentType },
    });
  }
}

function liftResult(fn) {
  return function (...args) {
    try {
      return { value: fn(...args) };
    } catch (e) {
      return { error: e.message };
    }
  };
}

async function handler(request: Request): Response {
  const url = new URL(request.url);
  console.info(`${request.method} ${url.pathname}`);
  switch (url.pathname) {
    case "/api/vorp/2024":
      return handleResultJSON(await getVorpForSeason(2024));
    case "/api/vorp/2024.csv":
      return handleResultText(
        mapResult(liftResult(generateCSV), await getVorpForSeason(2024)),
        "text/csv"
      );
    case "/api/vorp/2023":
      return handleResultJSON(await getVorpForSeason(2023));
  }
  return new Response("Not Found", { status: 404, statusText: "Not Found" });
}
Deno.serve(handler);
