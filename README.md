# NEPSE EMA Scanner

A comprehensive tool for scraping, analyzing, and visualizing Nepal Stock Exchange (NEPSE) data using Exponential Moving Averages (EMA).

## Project Structure

The project is organized into several modules:

-   `data/`: Contains historical stock data in CSV format (Ignored by Git).
-   `scripts/`: Utility scripts for data processing.
    -   `export-data-json.py`: Exports database to a static JSON file for the offline dashboard.
    -   `migrate-csv-to-sqlite.py`: Migrates historical CSV files into the SQLite database.
    -   `sync-data.py`: Downloads latest historical data directly into SQLite.
-   `src/`: Main source code.
    -   `backend/`: FastAPI backend for stock analysis (optional for static mode).
    -   `scraper/`: Selenium-based scraper for NEPSE today's share price.
    -   `web-svelte/`: Modern SvelteKit dashboard with full EMA analysis.

## Setup & Usage

The project includes a convenient `run.sh` script to handle common tasks.

### 1. Installation

Install all Python and Node.js dependencies:

```bash
./run.sh install
```

### 2. Syncing Historical Data (Recommended)

Since the EMA calculation requires historical data, sync from the community repository:

```bash
./run.sh sync
```
This populates the SQLite database in `data/nepse.db`.

### 3. Scraping Data

To fetch the absolute latest data:

```bash
./run.sh scrape [MM/DD/YYYY]
```

### 4. Processing Data (for Offline Mode)

To use the dashboard without the FastAPI backend, export the database to a static JSON file:

```bash
python scripts/export-data-json.py
```
The frontend will automatically fall back to this data if the backend is unreachable.

### 5. Running the Application

To start the SvelteKit frontend in development mode:

```bash
./run.sh frontend
```
-   **Frontend**: http://localhost:5173

### 6. Building for Production

To generate a zero-dependency static build:

```bash
cd src/web-svelte && npm run build
```
The output will be in `src/web-svelte/build/`.

## Features

-   **SQLite Data Pipeline:** Single source of truth for all data, indexed and optimized.
-   **EMA Analysis:** Calculates 90-day EMA to identify Above/Below/Within trends.
-   **Modern Dashboard:** SvelteKit-powered UI with tooltips, mobile support, and dark mode.
-   **Interactive Onboarding:** Built-in tutorial for new users.
-   **Offline Fallback:** Works even without a running backend using exported JSON data.

## License

MIT License.
