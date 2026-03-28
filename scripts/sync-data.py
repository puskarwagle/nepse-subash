import os
import requests
import datetime
import glob

# Configuration
REMOTE_REPO = "sbmagar13/sharesansar_datascrape"
REMOTE_DATA_URL = f"https://raw.githubusercontent.com/{REMOTE_REPO}/master/data/"
LOCAL_DATA_DIR = "data"

def get_local_dates():
    """Get a set of dates already present locally in YYYY-MM-DD format"""
    local_files = glob.glob(os.path.join(LOCAL_DATA_DIR, "*.csv"))
    dates = set()
    for f in local_files:
        filename = os.path.basename(f)
        try:
            # Convert MM_DD_YYYY to YYYY-MM-DD
            parts = filename.replace(".csv", "").split("_")
            if len(parts) == 3:
                date_str = f"{parts[2]}-{parts[0]}-{parts[1]}"
                dates.add(date_str)
        except:
            continue
    return dates

def sync():
    if not os.path.exists(LOCAL_DATA_DIR):
        os.makedirs(LOCAL_DATA_DIR)

    local_dates = get_local_dates()
    print(f"Found {len(local_dates)} local data files.")

    # We'll try to sync the last 120 days (enough for 90-day EMA)
    today = datetime.date.today()
    synced_count = 0
    
    print("Syncing missing historical data (last 120 days)...")
    
    for i in range(120):
        target_date = today - datetime.timedelta(days=i)
        date_iso = target_date.strftime("%Y-%m-%d")
        
        if date_iso in local_dates:
            continue
            
        # Try to download the file (naming in remote repo is YYYY-MM-DD.csv)
        remote_filename = f"{date_iso}.csv"
        url = f"{REMOTE_DATA_URL}{remote_filename}"
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                # Convert back to our format: MM_DD_YYYY.csv
                local_filename = target_date.strftime("%m_%d_%Y.csv")
                local_path = os.path.join(LOCAL_DATA_DIR, local_filename)
                
                with open(local_path, "wb") as f:
                    f.write(response.content)
                
                print(f"  + Downloaded: {local_filename}")
                synced_count += 1
        except Exception as e:
            # Silently fail for weekends/holidays where data doesn't exist
            pass

    print(f"\nSync complete! Added {synced_count} new files.")
    if synced_count > 0:
        print("Run './run.sh process' to update the static frontend data.")

if __name__ == "__main__":
    sync()
