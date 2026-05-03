import sqlite3
import json
import os
import sys

# Add src to python path to import db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.db.database import get_db_connection

def export_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all symbols
    cursor.execute("SELECT DISTINCT symbol FROM daily_prices ORDER BY symbol")
    symbols = [row['symbol'] for row in cursor.fetchall()]
    
    # Get last 120 days of data for each symbol
    # Actually, let's just get the most recent 120 dates first
    cursor.execute("SELECT DISTINCT date FROM daily_prices ORDER BY date DESC LIMIT 120")
    recent_dates = [row['date'] for row in cursor.fetchall()]
    if not recent_dates:
        print("No data found in database.")
        return
        
    oldest_date = recent_dates[-1]
    
    data = {
        "symbols": symbols,
        "prices": {},
        "last_updated": recent_dates[0]
    }
    
    print(f"Exporting data since {oldest_date}...")
    
    for symbol in symbols:
        cursor.execute("""
            SELECT date, open, high, low, close, volume 
            FROM daily_prices 
            WHERE symbol = ? AND date >= ?
            ORDER BY date ASC
        """, (symbol, oldest_date))
        
        prices = []
        for row in cursor.fetchall():
            prices.append({
                "date": row['date'],
                "open": row['open'],
                "high": row['high'],
                "low": row['low'],
                "close": row['close'],
                "volume": row['volume']
            })
        
        if prices:
            data["prices"][symbol] = prices

    # Write to static folder in Svelte app for local development
    # And potentially build folder for deployment
    output_dir = os.path.join('src', 'web-svelte', 'static')
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, 'data.json')
    with open(output_path, 'w') as f:
        json.dump(data, f)
        
    print(f"Data exported to {output_path}")
    conn.close()

if __name__ == "__main__":
    export_data()
