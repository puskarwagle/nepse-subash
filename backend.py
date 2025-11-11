from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import glob
from typing import List, Optional
from datetime import datetime

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StockRequest(BaseModel):
    symbols: List[str]
    ema_period: int = 90
    date: Optional[str] = None  # Format: YYYY-MM-DD


def clean_numeric(value):
    """Remove commas from numeric strings"""
    if isinstance(value, str):
        return value.replace(',', '')
    return value


def load_all_data():
    """Load all CSV files and combine into single DataFrame"""
    all_files = sorted(glob.glob('./data/*.csv'))

    dfs = []
    for file in all_files:
        # Extract date from filename (MM_DD_YYYY.csv)
        date_str = file.split('/')[-1].replace('.csv', '')
        date_parts = date_str.split('_')
        date = f"{date_parts[2]}-{date_parts[0]}-{date_parts[1]}"

        df = pd.read_csv(file)
        df['Date'] = date
        dfs.append(df)

    combined = pd.concat(dfs, ignore_index=True)

    # Clean numeric columns
    for col in ['Open', 'High', 'Low', 'Close']:
        combined[col] = pd.to_numeric(combined[col].apply(clean_numeric), errors='coerce')

    combined['Date'] = pd.to_datetime(combined['Date'])
    combined = combined.sort_values(['Symbol', 'Date'])

    return combined


def calculate_ema(series, period):
    """Calculate Exponential Moving Average"""
    return series.ewm(span=period, adjust=False).mean()


def analyze_stock(symbol: str, period: int, df: pd.DataFrame, target_date: Optional[str] = None):
    """Analyze single stock against EMA range"""
    stock_data = df[df['Symbol'] == symbol].copy()

    if stock_data.empty:
        return None

    # Filter data up to target date if specified
    if target_date:
        target_dt = pd.to_datetime(target_date)
        stock_data = stock_data[stock_data['Date'] <= target_dt]

        if stock_data.empty:
            return None

    # Calculate EMA on High and Low
    stock_data['EMA_High'] = calculate_ema(stock_data['High'], period)
    stock_data['EMA_Low'] = calculate_ema(stock_data['Low'], period)

    # Get latest values (up to target date)
    latest = stock_data.iloc[-1]
    current_price = latest['Close']
    ema_high = latest['EMA_High']
    ema_low = latest['EMA_Low']
    last_date = latest['Date']

    # Determine status
    if current_price > ema_high:
        status = "above"
    elif current_price < ema_low:
        status = "below"
    else:
        status = "within"

    return {
        "symbol": symbol,
        "current_price": round(current_price, 2),
        "ema_high": round(ema_high, 2),
        "ema_low": round(ema_low, 2),
        "status": status,
        "last_updated": last_date.strftime('%Y-%m-%d')
    }


# Load data once at startup
print("Loading historical data...")
historical_data = load_all_data()
print(f"Loaded {len(historical_data)} records")


@app.get("/")
def root():
    return {"message": "NEPSE EMA Scanner API"}


@app.get("/symbols")
def get_available_symbols():
    """Get list of all available stock symbols"""
    symbols = sorted(historical_data['Symbol'].unique().tolist())
    return {"symbols": symbols}


@app.post("/analyze")
def analyze_stocks(request: StockRequest):
    """Analyze selected stocks against EMA range"""
    results = []

    for symbol in request.symbols:
        analysis = analyze_stock(symbol, request.ema_period, historical_data, request.date)
        if analysis:
            results.append(analysis)
        else:
            results.append({
                "symbol": symbol,
                "error": "No data found"
            })

    return {
        "results": results,
        "ema_period": request.ema_period,
        "date": request.date
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
