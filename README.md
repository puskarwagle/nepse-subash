# NEPSE EMA Scanner

A comprehensive tool for scraping, analyzing, and visualizing Nepal Stock Exchange (NEPSE) data using Exponential Moving Averages (EMA).

## Project Structure

The project is organized into several modules:

-   `data/`: Contains historical stock data in CSV format (Ignored by Git).
-   `scripts/`: Utility scripts for data processing.
    -   `convert-to-json.py`: Converts CSV data into JavaScript batches for the static frontend.
-   `src/`: Main source code.
    -   `backend/`: FastAPI backend for stock analysis.
    -   `scraper/`: Selenium-based scraper for NEPSE today's share price.
    -   `web-static/`: A lightweight, static HTML/JS frontend that works with pre-processed JSON data.
    -   `web-svelte/`: A modern SvelteKit-based frontend.

## Setup & Usage

The project includes a convenient `run.sh` script to handle common tasks.

### 1. Installation

Install all Python and Node.js dependencies:

```bash
./run.sh install
```

### 2. Syncing Historical Data (Recommended)

Since the EMA calculation requires at least 90 days of history, it is recommended to sync the latest data from the community repository:

```bash
./run.sh sync
```
This will download the last 120 days of trading data directly into your `data/` folder.

### 3. Scraping Data

To fetch the absolute latest data (e.g., today's price):

```bash
./run.sh scrape [MM/DD/YYYY]
```
If no date is provided, it defaults to today's date. Data is saved in the `data/` directory.

### 4. Processing Data (for Static Frontend)

If you wish to use the lightweight static frontend, process the CSV data:

```bash
./run.sh process
```
This generates data batches in `src/web-static/` (Ignored by Git).

### 5. Running the Application

To start both the FastAPI backend and the SvelteKit frontend simultaneously:

```bash
./run.sh run
```
-   **Backend**: http://localhost:8000
-   **Frontend**: http://localhost:5173

### 5. Individual Components

You can also run components individually:
-   `./run.sh backend`: Start only the FastAPI server.
-   `./run.sh frontend`: Start only the SvelteKit dev server.

## Git Configuration

A `.gitignore` file is included to keep the repository clean. It ignores:
-   Large CSV data files (`data/*.csv`)
-   Generated JS data batches (`src/web-static/data-batch-*.js`)
-   `node_modules/` and `.svelte-kit/`
-   Python `__pycache__` and virtual environments

## Features

-   **Automated Scraping:** Fetches daily floorsheet data from Sharesansar.
-   **EMA Analysis:** Calculates 90-day EMA (High/Low) to determine if a stock is "Above", "Below", or "Within" the EMA range.
-   **Interactive Visualization:** Modern SvelteKit dashboard to track your portfolio against EMA ranges.
-   **Dual Frontend:** Choose between a full-featured SvelteKit app or a zero-dependency static HTML version.

## License

MIT License.
