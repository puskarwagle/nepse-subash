import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import sqlite3
from typing import List, Optional
from datetime import datetime

from src.db.database import get_db_connection

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

def calculate_ema(series, period):
    """Calculate Exponential Moving Average"""
    return series.ewm(span=period, adjust=False).mean()

def analyze_stock(symbol: str, period: int, df: pd.DataFrame, target_date: Optional[str] = None):
    """Analyze single stock against EMA range"""
    stock_data = df[df['symbol'] == symbol].copy()

    if stock_data.empty:
        return None

    # Filter data up to target date if specified
    if target_date:
        target_dt = pd.to_datetime(target_date)
        stock_data = stock_data[stock_data['date'] <= target_dt]

        if stock_data.empty:
            return None

    # Ensure date is datetime and sorted
    stock_data['date'] = pd.to_datetime(stock_data['date'])
    stock_data = stock_data.sort_values('date')

    # Calculate EMA on High and Low
    stock_data['EMA_High'] = calculate_ema(stock_data['high'], period)
    stock_data['EMA_Low'] = calculate_ema(stock_data['low'], period)

    # Get latest values (up to target date)
    latest = stock_data.iloc[-1]
    current_price = latest['close']
    ema_high = latest['EMA_High']
    ema_low = latest['EMA_Low']
    last_date = latest['date']

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

@app.get("/")
def root():
    return {"message": "NEPSE EMA Scanner API"}

@app.get("/symbols")
def get_available_symbols():
    """Get list of all available stock symbols"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT symbol FROM daily_prices ORDER BY symbol")
    symbols = [row['symbol'] for row in cursor.fetchall()]
    conn.close()
    return {"symbols": symbols}

@app.post("/analyze")
def analyze_stocks(request: StockRequest):
    """Analyze selected stocks against EMA range"""
    results = []

    if not request.symbols:
        return {"results": [], "ema_period": request.ema_period, "date": request.date}

    conn = get_db_connection()
    
    # Query data for the requested symbols
    symbols_placeholder = ','.join(['?'] * len(request.symbols))
    query = f"SELECT symbol, date, high, low, close FROM daily_prices WHERE symbol IN ({symbols_placeholder})"
    params = tuple(request.symbols)
    
    # Optional date filter at query level
    if request.date:
        query += " AND date <= ?"
        params += (request.date,)
        
    query += " ORDER BY symbol, date"
    
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()

    if df.empty:
        return {
            "results": [{"symbol": sym, "error": "No data found"} for sym in request.symbols],
            "ema_period": request.ema_period,
            "date": request.date
        }

    for symbol in request.symbols:
        analysis = analyze_stock(symbol, request.ema_period, df, request.date)
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
