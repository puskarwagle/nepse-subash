# NEPSE EMA Scanner

A simple web app for fund managers to track stocks against EMA (Exponential Moving Average) ranges.

## What it does

- Calculates EMA on High and Low prices (default: 90 periods, configurable)
- Shows if current stock price is **Above**, **Below**, or **Within** the EMA range
- Single-page dashboard with easy stock selection
- Color-coded results (green/red/orange)

## How to run

### 1. Install dependencies

```bash
pip install fastapi uvicorn pandas pydantic
```

### 2. Start the backend

```bash
python backend.py
```

Server runs on http://localhost:8000

### 3. Open the frontend

```bash
# Option 1: Open directly in browser
open index.html

# Option 2: Use a simple HTTP server (recommended)
python -m http.server 3000
# Then open http://localhost:3000
```

## How the EMA calculation works

**EMA formula:**
```
EMA_today = (Price_today × multiplier) + (EMA_yesterday × (1 - multiplier))
multiplier = 2 / (period + 1)
```

For EMA 90: multiplier = 2/91 = 0.021978

The algorithm:
1. Uses pandas `.ewm(span=period, adjust=False).mean()`
2. Calculates two EMAs: one on HIGH prices, one on LOW prices
3. Creates a range/channel between EMA_Low and EMA_High
4. Compares current close price against this range

## Status meanings

- **Above**: `Close > EMA_High` → Bullish momentum
- **Below**: `Close < EMA_Low` → Bearish momentum
- **Within**: `EMA_Low <= Close <= EMA_High` → Consolidating

## Data

- Located in `./data/` directory
- CSV files named `MM_DD_YYYY.csv`
- Current range: **Jan 1, 2022 to Dec 31, 2024** (3 years)

## API Endpoints

### GET /symbols
Returns list of all available stock symbols

### POST /analyze
Analyzes selected stocks against EMA range

**Request:**
```json
{
  "symbols": ["NABIL", "ADBL", "UPPER"],
  "ema_period": 90
}
```

**Response:**
```json
{
  "results": [
    {
      "symbol": "NABIL",
      "current_price": 509.0,
      "ema_high": 519.6,
      "ema_low": 509.12,
      "status": "below",
      "last_updated": "2024-12-31"
    }
  ],
  "ema_period": 90
}
```

## Next steps

1. **Live data scraper**: Build a bot to fetch latest prices from NEPSE
2. **Alerts**: Add email/push notifications when stocks cross EMA boundaries
3. **Historical charts**: Visualize price + EMA lines over time
4. **Multiple EMA periods**: Compare 50, 90, 200 EMAs side-by-side
5. **Persistence**: Save user's selected stocks in localStorage/database

## Files

- `backend.py` - FastAPI server with EMA calculation logic
- `index.html` - Single-page dashboard UI
- `data/` - Historical NEPSE data (CSV files)
