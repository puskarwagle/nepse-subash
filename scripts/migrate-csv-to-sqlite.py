import os
import glob
import pandas as pd
import sqlite3
import sys

# Add src to python path to import db
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from src.db.database import get_db_connection, init_db

def clean_numeric(value):
    """Remove commas from numeric strings"""
    if isinstance(value, str):
        return value.replace(',', '')
    return value

def migrate():
    print("Initializing database...")
    init_db()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    csv_files = sorted(glob.glob('data/*.csv'))
    if not csv_files:
        print("No CSV files found in data/")
        return

    print(f"Found {len(csv_files)} CSV files to migrate.")
    total_records = 0
    
    for file in csv_files:
        # Extract date from filename (MM_DD_YYYY.csv)
        date_str = os.path.basename(file).replace('.csv', '')
        date_parts = date_str.split('_')
        if len(date_parts) != 3:
            continue
        date = f"{date_parts[2]}-{date_parts[0]}-{date_parts[1]}"
        
        try:
            df = pd.read_csv(file)
            if df.empty:
                continue
                
            # Clean numeric columns
            for col in ['Open', 'High', 'Low', 'Close']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col].apply(clean_numeric), errors='coerce')
            
            # Map columns to DB schema
            # CSV typically has: Symbol, Open, High, Low, Close, Volume (sometimes)
            for _, row in df.iterrows():
                symbol = row.get('Symbol')
                open_val = row.get('Open', 0.0)
                high_val = row.get('High', 0.0)
                low_val = row.get('Low', 0.0)
                close_val = row.get('Close', 0.0)
                # Some CSVs might not have volume, handle gracefully
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
                """, (symbol, date, open_val, high_val, low_val, close_val, volume_val))
                total_records += 1
                
        except Exception as e:
            print(f"Error processing {file}: {e}")
            
    conn.commit()
    conn.close()
    print(f"Migration complete. Inserted/Updated {total_records} records.")

if __name__ == "__main__":
    migrate()
