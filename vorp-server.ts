import { allPlayersWithVorp } from "./vorp.ts";
import { generateCSV } from "./vorp-csv.ts";
import { fetchSeasonStatsCached } from "./vorp-data.ts";

type Result = { value: object; error: string };

function mapResult(fn, { value, error }) {
  if (error || !value) {
    return { value, error };
  } else {
    return fn(value);
  }
}

async function getVorpForSeason(season: number): Promise<Result> {
  try {
    const playerStats = await fetchSeasonStatsCached(season);
    return { value: allPlayersWithVorp(playerStats) };
  } catch (e) {
    return { error: e.message };
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
  contentType: string = "text/html"
) {
  if (error || !value) {
    return new Response(error, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  } else {
    return new Response(value as string, {
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

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  console.info(`${request.method} ${url.pathname}`);

  // Extract season from path segments like /api/vorp/2024/...
  const seasonMatch = url.pathname.match(/^\/api\/vorp\/(\d{4})/);
  const season = seasonMatch ? parseInt(seasonMatch[1], 10) : null;

  switch (url.pathname) {
    case `/api/vorp/${season}`:
      return handleResultJSON(await getVorpForSeason(season));

    case `/api/vorp/${season}.csv`:
      return handleResultText(
        mapResult(liftResult(generateCSV), await getVorpForSeason(season)),
        "text/csv"
      );

    case `/api/vorp/${season}/projected`:
      return handleVorpProjected(season, "json");

    case `/api/vorp/${season}/projected.csv`:
      return handleVorpProjected(season, "csv");

    case `/api/vorp/${season}/curve`:
      return handleVorpCurve(season, "full");

    case `/api/vorp/${season}/curve/summary`:
      return handleVorpCurve(season, "summary");
  }

  if (request.method === "POST" && url.pathname === `/api/vorp/${season}/trade`) {
    return handleTrade(request, season);
  }

  return new Response("Not Found", { status: 404, statusText: "Not Found" });
}

async function handleVorpProjected(
  season: number,
  format: "json" | "csv"
): Promise<Response> {
  try {
    const { fetchAndBuildProjections } = await import("./vorp-projections.ts");
    const { generateCSV } = await import("./vorp-csv.ts");
    const { allPlayersWithVorp } = await import("./vorp.ts");
    const projections = await fetchAndBuildProjections(season);
    const vorpData = allPlayersWithVorp(projections);
    if (format === "csv") {
      return new Response(generateCSV(vorpData), {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      });
    }
    return new Response(JSON.stringify(vorpData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleVorpCurve(
  season: number,
  mode: "full" | "summary"
): Promise<Response> {
  try {
    const { buildVorpCurveReport } = await import("./vorp-report.ts");
    const { allPlayersWithVorp } = await import("./vorp.ts");
    const playerStats = await fetchSeasonStatsCached(season);
    const vorpData = allPlayersWithVorp(playerStats);
    const report = buildVorpCurveReport(vorpData, playerStats, season, 12);
    const payload = mode === "summary" ? report.summary : report;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleTrade(
  request: Request,
  season: number
): Promise<Response> {
  try {
    const { evaluateTrade } = await import("./vorp-trade.ts");
    const { allPlayersWithVorp } = await import("./vorp.ts");
    const body = await request.json();
    const { give, receive, leagueSize = 12 } = body;
    if (!give || !receive) {
      return new Response(
        JSON.stringify({ error: "Body must include 'give' and 'receive' arrays" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const playerStats = await fetchSeasonStatsCached(season);
    const vorpData = allPlayersWithVorp(playerStats, leagueSize);
    const result = evaluateTrade(give, receive, vorpData);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
