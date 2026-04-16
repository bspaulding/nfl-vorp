/**
 * NFL VORP In-Draft Tool
 *
 * Usage:
 *   deno run --allow-net vorp-draft-cli.ts [options]
 *
 * Options:
 *   --season=2025           Season to project (default: next calendar year)
 *   --league-size=12        Number of teams (default: 12)
 *   --sleeper-draft=<id>    Sleeper draft ID for live pick tracking
 *   --top=8                 Top N players to show per section (default: 8)
 *
 * Interactive commands (type and press Enter):
 *   pick <name>             Mark a player as drafted
 *   undo                    Undo the last manual pick
 *   avail [position]        Re-display available players (optionally filtered)
 *   quit / q                Exit
 */

import { readLines } from "https://deno.land/std@0.224.0/io/read_lines.ts";
import { allPlayersWithVorp } from "./vorp.ts";
import { fetchAndBuildProjections } from "./vorp-projections.ts";
import {
  applySleeperPicks,
  createDraftState,
  fetchSleeperDraftPicks,
  fetchSleeperPlayerMap,
  findByName,
  getAvailable,
  markDrafted,
  undoLastPick,
} from "./vorp-draft.ts";
import type { DraftState, SleeperPlayer } from "./vorp-draft.ts";
import type { PlayerWithVORP } from "./vorp.ts";

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(args: string[]) {
  const flags: Record<string, string> = {};
  for (const arg of args) {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) flags[m[1]] = m[2];
  }
  return flags;
}

const flags = parseArgs(Deno.args);
const season = flags["season"]
  ? parseInt(flags["season"], 10)
  : new Date().getFullYear() + 1;
const leagueSize = flags["league-size"] ? parseInt(flags["league-size"], 10) : 12;
const sleeperDraftId = flags["sleeper-draft"] ?? null;
const topN = flags["top"] ? parseInt(flags["top"], 10) : 8;

// ── Startup ───────────────────────────────────────────────────────────────────

console.log(`\nNFL VORP Draft Board — ${season} Season (${leagueSize}-team league)`);
console.log("Loading projected stats...");

const projections = await fetchAndBuildProjections(season);
const projectedVorp = allPlayersWithVorp(projections, leagueSize);
const state = createDraftState();

let playerMap: Record<string, SleeperPlayer> | null = null;

if (sleeperDraftId) {
  console.log("Loading Sleeper player map...");
  playerMap = await fetchSleeperPlayerMap();
  const picks = await fetchSleeperDraftPicks(sleeperDraftId);
  const n = applySleeperPicks(state, picks, playerMap);
  console.log(`Synced ${n} picks from Sleeper draft ${sleeperDraftId}.`);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const POSITIONS = ["QB", "RB", "WR", "TE", "K"];
const COL = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

function fmt(p: PlayerWithVORP, rank: number): string {
  const pos = p.meta.player.Position.padEnd(3);
  const name = p.name.padEnd(22).slice(0, 22);
  const vorp = p.vorpPerGame.toFixed(2).padStart(5);
  const pts = p.points.perGame.toFixed(1).padStart(5);
  return `  ${String(rank).padStart(2)}. ${COL.bold}${name}${COL.reset} ${COL.dim}${pos}${COL.reset}  ${COL.green}${vorp}${COL.reset} VORP/gm  ${COL.dim}${pts} pts/gm${COL.reset}`;
}

function render(filterPosition?: string) {
  console.clear();

  // Header
  const header = `NFL VORP Draft Board — ${season} (${leagueSize}-team)`;
  const sleeperTag = sleeperDraftId
    ? `  ${COL.cyan}Sleeper: ${sleeperDraftId}${COL.reset}  Picks tracked: ${state.picks.length}`
    : `  ${COL.dim}Manual mode${COL.reset}`;
  console.log(`${COL.bold}${header}${COL.reset}${sleeperTag}`);
  console.log("─".repeat(60));

  if (filterPosition) {
    // Filtered view — show more players for one position
    const avail = getAvailable(state, projectedVorp, {
      position: filterPosition,
      topN: topN * 3,
    });
    console.log(
      `\n${COL.bold}AVAILABLE ${filterPosition.toUpperCase()}s (${avail.length} remaining)${COL.reset}`
    );
    avail.forEach((p, i) => console.log(fmt(p, i + 1)));
  } else {
    // Default view — top overall + compact per-position rows
    const overall = getAvailable(state, projectedVorp, { topN });
    console.log(`\n${COL.bold}TOP AVAILABLE${COL.reset}`);
    overall.forEach((p, i) => console.log(fmt(p, i + 1)));

    console.log(`\n${COL.bold}BY POSITION${COL.reset}  ${COL.dim}(top 4 each)${COL.reset}`);
    for (const pos of POSITIONS) {
      const top = getAvailable(state, projectedVorp, { position: pos, topN: 4 });
      if (top.length === 0) {
        console.log(`  ${pos.padEnd(3)}  ${COL.dim}(none available)${COL.reset}`);
        continue;
      }
      const names = top
        .map((p) => `${p.name.split(" ").pop()} ${COL.green}${p.vorpPerGame.toFixed(1)}${COL.reset}`)
        .join("  ");
      console.log(`  ${COL.bold}${pos.padEnd(3)}${COL.reset}  ${names}`);
    }
  }

  // Recent picks
  if (state.picks.length > 0) {
    const recent = state.picks.slice(-5).reverse();
    console.log(`\n${COL.bold}RECENT PICKS${COL.reset}`);
    for (const pick of recent) {
      console.log(
        `  ${COL.dim}#${String(pick.pickNo).padStart(3)}${COL.reset}  ${pick.playerName} ${COL.dim}(${pick.position})${COL.reset}`
      );
    }
  }

  console.log("\n" + "─".repeat(60));
  if (sleeperDraftId) {
    console.log(
      `${COL.dim}Auto-refreshing from Sleeper every 30s. Commands: avail [pos]  |  pick <name>  |  undo  |  quit${COL.reset}`
    );
  } else {
    console.log(
      `${COL.dim}Commands: pick <name>  |  avail [pos]  |  undo  |  quit${COL.reset}`
    );
  }
  Deno.stdout.writeSync(new TextEncoder().encode("> "));
}

// ── Command handling ──────────────────────────────────────────────────────────

async function handleCommand(line: string): Promise<boolean> {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(" ");

  switch (cmd.toLowerCase()) {
    case "quit":
    case "q":
    case "exit":
      return false; // signal to exit

    case "avail":
    case "available": {
      const pos = arg.toUpperCase();
      render(POSITIONS.includes(pos) ? pos : undefined);
      break;
    }

    case "refresh": {
      if (sleeperDraftId && playerMap) {
        const picks = await fetchSleeperDraftPicks(sleeperDraftId);
        applySleeperPicks(state, picks, playerMap);
      }
      render();
      break;
    }

    case "pick": {
      if (!arg) {
        console.log("Usage: pick <player name>");
        break;
      }
      const available = getAvailable(state, projectedVorp);
      const match = findByName(arg, available);
      if (!match) {
        console.log(`No available player matching "${arg}". Try a last name.`);
        Deno.stdout.writeSync(new TextEncoder().encode("> "));
        break;
      }
      markDrafted(state, match.meta.player.PlayerID, {
        playerName: match.name,
        position: match.meta.player.Position,
      });
      render();
      break;
    }

    case "undo": {
      const undone = undoLastPick(state);
      if (undone) {
        console.log(`Undid: ${undone.playerName}`);
        render();
      } else {
        console.log("Nothing to undo.");
        Deno.stdout.writeSync(new TextEncoder().encode("> "));
      }
      break;
    }

    default:
      if (cmd) {
        console.log(`Unknown command: "${cmd}". Try: pick, avail, undo, refresh, quit`);
        Deno.stdout.writeSync(new TextEncoder().encode("> "));
      } else {
        Deno.stdout.writeSync(new TextEncoder().encode("> "));
      }
      break;
  }

  return true; // continue
}

// ── Sleeper polling ───────────────────────────────────────────────────────────

if (sleeperDraftId && playerMap) {
  setInterval(async () => {
    try {
      const picks = await fetchSleeperDraftPicks(sleeperDraftId);
      const newPicks = applySleeperPicks(state, picks, playerMap!);
      if (newPicks > 0) render();
    } catch (e) {
      // Don't crash the CLI on a transient network error — just skip this poll
      console.error(`\nSleeper poll failed: ${e.message}`);
    }
  }, 30_000);
}

// ── Main loop ─────────────────────────────────────────────────────────────────

render();

for await (const line of readLines(Deno.stdin)) {
  const shouldContinue = await handleCommand(line);
  if (!shouldContinue) break;
}

console.log("Draft session ended.");
