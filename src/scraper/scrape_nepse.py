from selenium import webdriver
from datetime import datetime
from bs4 import BeautifulSoup
import pandas as pd
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import sys
import time


import chromedriver_autoinstaller as chromedriver
chromedriver.install()


def search(driver, date):
    """
    search by date
    """
    driver.get("https://www.sharesansar.com/today-share-price")
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.XPATH, "//input[@id='fromdate']"))
    )
    date_input = driver.find_element("xpath", "//input[@id='fromdate']")
    time.sleep(2)
    search_btn = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//input[@id='fromdate']")))
    # search_btn = driver.find_element("xpath", "//button[@id='btn_todayshareprice_submit']")
    date_input.send_keys(date)
    search_btn.click()
    if driver.find_elements("xpath", "//*[contains(text(), 'Could not find floorsheet matching the search criteria')]"):
        print("No data found for the given search.")
        print("Script Aborted")
        driver.close()
        sys.exit()


def get_page_table(driver, table_class):
    element = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.XPATH, "//div[@class='floatThead-wrapper']"))
    )
    soup = BeautifulSoup(driver.page_source, 'lxml')
    table = soup.find("table", {"class":table_class})
    tab_data = [[cell.text.replace('\r', '').replace('\n', '') for cell in row.find_all(["th","td"])]
                        for row in table.find_all("tr")]
    df = pd.DataFrame(tab_data)
    return df


def scrape_data(driver, date):
    search(driver, date = date)
    df = pd.DataFrame()
    count = 0
    while True:
        count += 1
        print(f"Scraping page {count}")
        page_table_df = get_page_table(driver, table_class="table table-bordered table-striped table-hover dataTable compact no-footer")
        df = df.append(page_table_df, ignore_index = True)
        try:
            next_btn = driver.find_element(By.LINK_TEXT, 'Next')
            driver.execute_script("arguments[0].click();", next_btn)
        except NoSuchElementException:
            break
    driver.close()
    return df


def clean_df(df):
    new_df = df.drop_duplicates(keep='first') # drop all duplicates
    new_header = new_df.iloc[0] # grabing the first row for the header
    new_df = new_df[1:] # taking the data lower than the header row
    new_df.columns = new_header # setting the header row as the df header
    new_df.drop(["S.No"], axis=1, inplace=True)
    return new_df


import os
import sys

# Add src to python path to import db
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from src.db.database import get_db_connection, init_db

def save_to_db(df, date_str):
    # Convert MM/DD/YYYY to YYYY-MM-DD
    date_parts = date_str.split('/')
    if len(date_parts) == 3:
        iso_date = f"{date_parts[2]}-{date_parts[0]}-{date_parts[1]}"
    else:
        iso_date = date_str
        
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    def clean_numeric(value):
        if isinstance(value, str):
            return value.replace(',', '')
        return value
        
    # Clean numeric columns
    for col in ['Open', 'High', 'Low', 'Close']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col].apply(clean_numeric), errors='coerce')
            
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
        """, (symbol, iso_date, open_val, high_val, low_val, close_val, volume_val))
        
    conn.commit()
    conn.close()
    print(f"Saved {len(df)} records for {iso_date} to database.")

def main():
    options = Options()
    options.headless = True
    options.add_argument="user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.115 Safari/537.36"
    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(120)

    # Use date from command line if provided, otherwise use today's date
    if len(sys.argv) > 1:
        date = sys.argv[1] # Expected format: MM/DD/YYYY
    else:
        date = datetime.today().strftime('%m/%d/%Y')

    # Ensure data directory exists
    if not os.path.exists("data"):
        os.makedirs("data")

    search(driver, date)
    df = scrape_data(driver, date)
    final_df = clean_df(df)
    save_to_db(final_df, date) # Save to SQLite database


if __name__ == "__main__":
    main()
