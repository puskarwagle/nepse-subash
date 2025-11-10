#!/usr/bin/env python3
import csv
import json
import glob
import os

# Get all CSV files
csv_files = sorted(glob.glob('/home/wagle/nepse/data/*.csv'))

# Group files in batches of 10
batch_size = 10
all_batches = []

for i in range(0, len(csv_files), batch_size):
    batch = csv_files[i:i+batch_size]
    batch_num = i // batch_size

    batch_data = []

    for csv_file in batch:
        # Extract date from filename (MM_DD_YYYY.csv)
        filename = os.path.basename(csv_file)
        parts = filename.replace('.csv', '').split('_')
        date_str = f'{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}'

        # Read CSV
        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                symbol = row.get('Symbol', '')
                close = row.get('Close', '').replace(',', '')
                if symbol and close:
                    try:
                        batch_data.append({
                            'symbol': symbol,
                            'date': date_str,
                            'close': float(close)
                        })
                    except:
                        pass

    # Write batch to JS file
    js_content = f'window.DATA_BATCH_{batch_num} = {json.dumps(batch_data)};'

    with open(f'/home/wagle/nepse/simple-app/data-batch-{batch_num}.js', 'w') as f:
        f.write(js_content)

    print(f'Created batch {batch_num} with {len(batch_data)} records from {len(batch)} files')
    all_batches.append(batch_num)

# Create index file
index_content = f'window.DATA_BATCHES = {json.dumps(all_batches)};'
with open('/home/wagle/nepse/simple-app/data-index.js', 'w') as f:
    f.write(index_content)

print(f'Created {len(all_batches)} batches total')
print(f'Total CSV files processed: {len(csv_files)}')
