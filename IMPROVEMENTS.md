# Technical Improvement Report: NEPSE EMA Scanner

This report outlines recommended architectural and operational improvements to simplify the current setup, increase reliability, and enhance the developer experience.

## 1. Unified Data Pipeline
**Current Issue:** Data is processed in two different ways:
- The FastAPI backend reads CSVs directly on every request/startup.
- The `convert-to-json.py` script manually generates static JS batches for the "simple" frontend.

**Improvement:** 
- **Single Source of Truth:** Move to a lightweight database like **SQLite**. 
- **Workflow:** The scraper/sync script should populate the SQLite DB. Both the FastAPI backend and any frontend build process should pull from this DB.
- **Benefit:** Eliminates the need for 140+ `.js` data batches and reduces the memory overhead of pandas loading hundreds of CSVs into a combined DataFrame.

## 2. Environment & Dependency Management
**Current Issue:** Global `pip` installations led to `ModuleNotFoundError` and version conflicts. 
**Improvement:**
- **Virtual Environments:** Force the use of a `.venv` folder in the root. Update `run.sh` to automatically create and activate it.
- **Containerization:** Provide a `Dockerfile` and `docker-compose.yaml`. This would allow a user to run the entire stack (Scraper + API + Frontend) with a single `docker-compose up` command, eliminating "it works on my machine" issues.

## 3. Frontend Consolidation
**Current Issue:** The project maintains two separate frontend architectures (`web-static` and `web-svelte`).
**Improvement:**
- **SvelteKit as Primary:** Fully migrate the logic from `web-static` into the SvelteKit app. 
- **Static Site Generation (SSG):** Use SvelteKit's `@sveltejs/adapter-static` to generate a zero-dependency build of the app if a "no-backend" version is still desired.
- **Benefit:** Reduces code duplication (EMA calculation logic is currently written in both Python and TypeScript).

## 4. Scraper Robustness
**Current Issue:** Selenium is "heavy," requires a Chrome installation, and is prone to breaking if the website's UI changes slightly.
**Improvement:**
- **Request-Based Scraping:** Investigate if the Sharesansar data can be fetched via direct `POST/GET` requests to their internal API endpoints, which are often faster and more stable than browser automation.
- **Headless Mode Enforcement:** Ensure the scraper is optimized for CI/CD environments (GitHub Actions) to allow for 24/7 automated updates without manual intervention.

## 5. Type Safety & Contract Testing
**Current Issue:** The SvelteKit frontend assumes the shape of the FastAPI response without a formal contract.
**Improvement:**
- **OpenAPI Integration:** Use FastAPI's auto-generated `openapi.json` to generate TypeScript types for the frontend using tools like `openapi-typescript`.
- **Benefit:** If the backend changes a field name (e.g., `ema_high` to `emaHigh`), the frontend build will fail immediately rather than breaking at runtime.

## 6. Intelligent Data Sync
**Current Issue:** The `sync` script is a manual step.
**Improvement:**
- **Auto-Sync on Startup:** Modify the backend to check the `data/` directory on startup. If it's empty or the last file is older than 24 hours, trigger a background sync automatically.
- **Benefit:** New users literally only have to run the app to see it working.

---
**Report Prepared By:** Gemini CLI  
**Date:** March 28, 2026
