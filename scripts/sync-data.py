import os
import requests
import datetime
import sqlite3
import pandas as pd
import io
import sys

# Add src to python path to import db
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from src.db.database import get_db_connection, init_db

# Configuration
REMOTE_REPO = "sbmagar13/sharesansar_datascrape"
REMOTE_DATA_URL = f"https://raw.githubusercontent.com/{REMOTE_REPO}/master/data/"

def clean_numeric(value):
    """Remove commas from numeric strings"""
    if isinstance(value, str):
        return value.replace(',', '')
    return value

def get_db_dates():
    """Get a set of dates already present in DB in YYYY-MM-DD format"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT date FROM daily_prices")
    dates = {row['date'] for row in cursor.fetchall()}
    conn.close()
    return dates

def sync():
    init_db()
    db_dates = get_db_dates()
    print(f"Found {len(db_dates)} dates in database.")

    # We'll try to sync the last 120 days (enough for 90-day EMA)
    today = datetime.date.today()
    synced_count = 0
    
    print("Syncing missing historical data (last 120 days)...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for i in range(120):
        target_date = today - datetime.timedelta(days=i)
        date_iso = target_date.strftime("%Y-%m-%d")
        
        if date_iso in db_dates:
            continue
            
        # Try to download the file (naming in remote repo is YYYY-MM-DD.csv)
        remote_filename = f"{date_iso}.csv"
        url = f"{REMOTE_DATA_URL}{remote_filename}"
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                # Parse CSV content into DataFrame
                csv_data = io.StringIO(response.content.decode('utf-8'))
                df = pd.read_csv(csv_data)
                
                if df.empty:
                    continue
                    
                for col in ['Open', 'High', 'Low', 'Close']:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col].apply(clean_numeric), errors='coerce')
                
                records_inserted = 0
                for _, row in df.iterrows():
                    symbol = row.get('Symbol')
                    open_val = row.get('Open', 0.0)
                    high_val = row.get('High', 0.0)
                    low_val = row.get('Low', 0.0)
                    close_val = row.get('Close', 0.0)
                    volume_val = row.get('Vol', 0.0) if 'Vol' in df.columns else row.get('Volume', 0.0)
                    if pd.isna(volume_val):
                        volume_val = 0.0
                    if isinstance(volume_val, str):
                        volume_val = float(clean_numeric(volume_val)) if clean_numeric(volume_val) else 0.0

                    if pd.isna(symbol):
                        continue
                    
                    cursor.execute("""
                        INSERT OR REPLACE INTO daily_prices (symbol, date, open, high, low, close, volume)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (symbol, date_iso, open_val, high_val, low_val, close_val, volume_val))
                    records_inserted += 1
                
                conn.commit()
                print(f"  + Synced {records_inserted} records for: {date_iso}")
                synced_count += 1
        except Exception as e:
            # Silently fail for weekends/holidays where data doesn't exist
            pass

    conn.close()
    print(f"\nSync complete! Added data for {synced_count} new dates.")

if __name__ == "__main__":
    sync()
