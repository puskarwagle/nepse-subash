# NEPSE EMA Scanner

A web app for tracking Nepal Stock Exchange (NEPSE) stocks against their 90-day Exponential Moving Average (EMA) range.

Each stock is flagged **Above**, **Below**, or **Within** its EMA range, so you can quickly see breakouts, breakdowns, and consolidations.

## Tech Stack

| Piece    | Tech                                          | Dir        |
| -------- | --------------------------------------------- | ---------- |
| Frontend | SvelteKit (Svelte 5, adapter-static)          | `frontend/` |
| Backend  | Bun + Hono (TypeScript API server)            | `backend/`  |
| Data     | Single committed JSON file (`data.json`)      | `frontend/static/` |
| Scripts  | Bun TypeScript scripts                        | `scripts/`  |

No database, no Python. The frontend ships `data.json` in its `static/` folder, so a static build works anywhere — the backend is optional.

## Quick Start

Requires [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```bash
# 1. Install + run the frontend (data.json is committed, so it works immediately)
cd frontend
bun install
bun run dev        # http://localhost:5173

# 2. Optional: install + run the backend API
cd backend
bun install
bun run dev        # http://localhost:8000
```

The frontend proxies `/api/*` to the backend automatically. If the backend isn't running, the frontend falls back to the bundled `data.json` and still works.

## Updating Data

There's one source of truth: `frontend/static/data.json`. Two scripts update it (run from the repo root):

```bash
bun install                 # one-time
bun run fetch-data          # pull the latest ~120 trading days from the community sharesansar mirror
bun run scrape-today        # live-scrape today's prices from sharesansar.com
bun run scrape-today --date=08/19/2026   # scrape a specific day (MM/DD/YYYY)
```

- `fetch-data` is the normal path — incremental, hits the GitHub repo `sbmagar13/sharesansar_datascrape`, only downloads missing dates.
- `scrape-today` needs a browser. First time: `bunx playwright install chromium`.
- A GitHub Actions workflow (`/.github/workflows/update-data.yml`) re-runs `fetch-data` on a schedule and commits fresh data.

Commit `frontend/static/data.json` whenever it changes — it's the dataset every user gets.

## Project Structure

```
nepse-subash/
├── frontend/                # SvelteKit app (bun install && bun run dev)
│   ├── src/
│   │   ├── routes/+page.svelte      # the whole dashboard UI
│   │   └── lib/
│   │       ├── utils/ema.ts         # EMA calculation + analysis
│   │       └── actions/tooltip.ts   # long-hover tooltips
│   └── static/data.json             # THE data file (committed)
├── backend/                 # Hono API (bun install && bun run dev)
│   └── src/
│       ├── index.ts         # server entry (port 8000)
│       ├── app.ts           # routes: GET /symbols, POST /analyze
│       └── ema.ts           # same EMA logic as the frontend
├── scripts/
│   ├── data.ts              # shared CSV parsing + data.json merge helpers
│   ├── fetch-data.ts        # pull history from the sharesansar mirror
│   └── scrape-today.ts      # live-scrape today's prices (Playwright)
└── package.json             # root: bun run fetch-data / bun run scrape-today
```

## How the EMA Analysis Works

- `calculateEMA(values, period)`: standard EMA, seeded with a simple moving average of the first `period` values, multiplier `2 / (period + 1)`.
- `analyzeStock(symbol, prices, period)`: computes one EMA over **highs** and one over **lows**, forming a range:
  - **Above** — close > EMA(high) → bullish breakout
  - **Below** — close < EMA(low) → bearish breakdown
  - **Within** — between the two → consolidating
- The same implementation lives in both `frontend/src/lib/utils/ema.ts` (client/offline) and `backend/src/ema.ts` (API). Keep them in sync if you change the math.

## Data Format

```jsonc
{
  "symbols": ["ADBL", "NABIL", "..."],
  "prices": {
    "NABIL": [
      { "date": "2026-08-20", "open": 550, "high": 552, "low": 547, "close": 548.5, "volume": 27241 }
    ]
  },
  "last_updated": "2026-08-20"
}
```

Each symbol keeps its most recent ~120 trading days (enough for a 90-day EMA).

## API

| Endpoint      | Method | Body                                | Returns                                    |
| ------------- | ------ | ----------------------------------- | ------------------------------------------ |
| `/symbols`    | GET    | —                                   | `{ symbols: string[] }`                    |
| `/analyze`    | POST   | `{ symbols, ema_period, date? }`    | `{ results, ema_period, date }`            |

## Production Build

```bash
cd frontend
bun run build     # static site -> frontend/build, deployable anywhere
```

The backend isn't needed in production — the static build uses the bundled `data.json`.

## License

MIT.