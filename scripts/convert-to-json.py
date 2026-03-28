#!/usr/bin/env python3
import json
import os
import sqlite3
import sys

# Add src to python path to import db
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from src.db.database import get_db_connection, init_db

init_db()
conn = get_db_connection()
cursor = conn.cursor()

# Get all unique dates in the DB ordered
cursor.execute("SELECT DISTINCT date FROM daily_prices ORDER BY date ASC")
dates = [row['date'] for row in cursor.fetchall()]

# We'll group dates in batches of 10 to mimic the old behavior (which grouped files by 10)
batch_size = 10
all_batches = []

# Map list of dates to their index so we can fetch records and group them easily
for i in range(0, len(dates), batch_size):
    batch_dates = dates[i:i+batch_size]
    batch_num = i // batch_size
    
    if not batch_dates:
        break
        
    placeholders = ','.join(['?'] * len(batch_dates))
    query = f"""
        SELECT symbol, date, close 
        FROM daily_prices 
        WHERE date IN ({placeholders})
        ORDER BY date ASC
    """
    
    cursor.execute(query, batch_dates)
    rows = cursor.fetchall()
    
    batch_data = []
    for row in rows:
        batch_data.append({
            'symbol': row['symbol'],
            'date': row['date'],
            'close': float(row['close']) if row['close'] else 0.0
        })
        
    # Write batch to JS file
    js_content = f'window.DATA_BATCH_{batch_num} = {json.dumps(batch_data)};'

    os.makedirs('src/web-static', exist_ok=True)
    with open(f'src/web-static/data-batch-{batch_num}.js', 'w') as f:
        f.write(js_content)

    print(f'Created batch {batch_num} with {len(batch_data)} records from {len(batch_dates)} dates')
    all_batches.append(batch_num)

# Create index file
index_content = f'window.DATA_BATCHES = {json.dumps(all_batches)};'
with open('src/web-static/data-index.js', 'w') as f:
    f.write(index_content)

print(f'Created {len(all_batches)} batches total')
print(f'Total dates processed: {len(dates)}')

conn.close()
