# nfl-vorp

Some experiments to calculate a Value Over Replacement Player for NFL Fantasy data.

## Getting Data

Input data of nfl stats can be gathered by running [nfl-data-scraper](https://www.github.com/bspaulding/nfl-data-scraper).

## Calculating VORP from stats

`deno run vorp.ts <path-to-nfl-data-export.json>`

## In-Draft Tool

An interactive terminal draft board that shows the top available players by projected VORP as picks are made.

### Manual mode

```sh
deno run --allow-net vorp-draft-cli.ts --season=2025 --league-size=12
```

At the `>` prompt:

| Command | Description |
|---|---|
| `pick <name>` | Mark a player as drafted (case-insensitive, partial name works) |
| `avail [position]` | Show available players; optionally filter to `QB`, `RB`, `WR`, `TE`, or `K` |
| `undo` | Undo the last manual pick |
| `quit` | Exit |

### With live Sleeper draft sync

```sh
deno run --allow-net vorp-draft-cli.ts --season=2025 --sleeper-draft=<draftId>
```

The draft ID is in the Sleeper URL when you're in a live draft: `sleeper.app/draft/nfl/<draftId>`. No API key required.

On startup, all existing picks are fetched from Sleeper automatically. The board then polls every 30 seconds and re-renders as new picks come in. Manual commands (`pick`, `avail`, `undo`) still work alongside auto-polling.

### Options

| Flag | Default | Description |
|---|---|---|
| `--season` | next calendar year | Season to project stats for |
| `--league-size` | `12` | Number of teams in the league |
| `--sleeper-draft` | _(none)_ | Sleeper draft ID for live pick sync |
| `--top` | `8` | Number of players to show in each section |
