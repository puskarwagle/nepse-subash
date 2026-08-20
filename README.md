# NEPSE Scanner

A mobile-first web app that screens the Nepal Stock Exchange (NEPSE) against each stock's **90-day Weighted Moving Average (WMA) band**.

For every stock it builds a band from **WMA of the highs** and **WMA of the lows**, then flags it as:

- **Above** — close above the WMA(high) line (bullish breakout)
- **Below** — close below the WMA(low) line (bearish breakdown)
- **Within** — consolidating inside the band

The whole market is screened at once: separate lists show which stocks are trading **above** and **below** the 90-day band, so you never have to check symbols one by one. The UI is designed for phones first.

## Tech Stack

| Piece    | Tech                                          | Dir        |
| -------- | --------------------------------------------- | ---------- |
| Frontend | SvelteKit (Svelte 5, adapter-static)          | `frontend/` |
| Backend  | Node + Hono (TypeScript API server)           | `backend/`  |
| Data     | Single committed JSON file (`data.json`)      | `frontend/static/` |
| Scripts  | Node TypeScript scripts                       | `scripts/`  |

No database, no Python. The frontend ships `data.json` in its `static/` folder, so a static build works anywhere — the backend is optional.

## Quick Start

Requires [Node.js](https://nodejs.org) 22.6+ (Node 24 LTS or newer recommended; Node's built-in TypeScript support is used to run the `.ts` scripts).

```bash
# 1. Install + run the frontend (data.json is committed, so it works immediately)
cd frontend
npm install
npm run dev        # http://localhost:5173

# 2. Optional: install + run the backend API
cd backend
npm install
npm run dev        # http://localhost:8000
```

The frontend proxies `/api/*` to the backend automatically. If the backend isn't running, the frontend falls back to the bundled `data.json` and still works.

## Updating Data

There's one source of truth: `frontend/static/data.json`. Two scripts update it (run from the repo root):

```bash
npm install                 # one-time
npm run fetch-data          # pull the latest ~120 trading days from the community sharesansar mirror
npm run scrape-today        # live-scrape today's prices from sharesansar.com
npm run scrape-today -- --date=08/19/2026   # scrape a specific day (MM/DD/YYYY)
```

- `fetch-data` is the normal path — incremental, hits the GitHub repo `sbmagar13/sharesansar_datascrape`, only downloads missing dates.
- `scrape-today` needs a browser. First time: `npx playwright install chromium`.
- A GitHub Actions workflow (`/.github/workflows/update-data.yml`) re-runs `fetch-data` on a schedule and commits fresh data.

Commit `frontend/static/data.json` whenever it changes — it's the dataset every user gets.

## Project Structure

```
nepse-subash/
├── frontend/                # SvelteKit app (npm install && npm run dev)
│   ├── src/
│   │   ├── routes/+page.svelte      # mobile-first screener UI (above/below band lists)
│   │   └── lib/
│   │       └── utils/wma.ts         # WMA calculation + band analysis
│   └── static/data.json             # THE data file (committed)
├── backend/                 # Hono API (npm install && npm run dev)
│   └── src/
│       ├── index.ts         # server entry (port 8000)
│       ├── app.ts           # routes: GET /symbols, POST /analyze, POST /screener
│       └── wma.ts           # same WMA logic as the frontend
├── scripts/
│   ├── data.ts              # shared CSV parsing + data.json merge helpers
│   ├── fetch-data.ts        # pull history from the sharesansar mirror
│   └── scrape-today.ts      # live-scrape today's prices (Playwright)
└── package.json             # root: npm run fetch-data / npm run scrape-today
```

## How the WMA Band Analysis Works

- `calculateWMA(values, period)`: weighted moving average — the most recent of the last `period` values gets weight `period`, the oldest gets weight 1, `WMA = Σ(weight × value) / Σ(weight)`.
- `analyzeStock(symbol, prices, period)`: computes one WMA over **highs** and one over **lows**, forming a band:
  - **Above** — close > WMA(high) → bullish breakout
  - **Below** — close < WMA(low) → bearish breakdown
  - **Within** — between the two → consolidating
- The same implementation lives in both `frontend/src/lib/utils/wma.ts` (client/offline) and `backend/src/wma.ts` (API). Keep them in sync if you change the math.

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

Each symbol keeps its most recent ~120 trading days (enough for a 90-day WMA).

## API

| Endpoint      | Method | Body                                | Returns                                    |
| ------------- | ------ | ----------------------------------- | ------------------------------------------ |
| `/symbols`    | GET    | —                                   | `{ symbols: string[] }`                    |
| `/analyze`    | POST   | `{ symbols, wma_period, date? }`    | `{ results, wma_period, date }`            |
| `/screener`   | POST   | `{ wma_period, date? }`             | `{ results, wma_period, date, total }`     |

`/screener` analyzes every symbol and returns only those with enough history — the same screening the frontend runs in the browser.

## Production Build

```bash
cd frontend
npm run build     # static site -> frontend/build, deployable anywhere
```

The backend isn't needed in production — the static build uses the bundled `data.json`.

## License

MIT.