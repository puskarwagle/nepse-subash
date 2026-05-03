# Plan: Unified Data Pipeline & UI/UX Consolidation

## Objective
1. **Data Pipeline:** Implement a single source of truth for the NEPSE EMA Scanner by replacing the multi-CSV data storage with a lightweight SQLite database to eliminate data duplication and memory overhead.
2. **Frontend Consolidation & UI/UX:** Fully migrate the logic from `web-static` into the SvelteKit app (`web-svelte`) using `@sveltejs/adapter-static` for zero-dependency builds. Overhaul the UI/UX to be highly intuitive with empty states, smart tooltips on long hover, and an interactive step-by-step onboarding tutorial for new users.

## Key Files & Context
- **Data Pipeline:** `data/nepse.db`, `src/db/database.py`, `scripts/migrate-csv-to-sqlite.py`, `src/scraper/scrape_nepse.py`, `src/backend/backend.py`
- **Frontend & UI/UX:**
  - `svelte.config.js` (Update to use adapter-static)
  - `src/web-svelte/src/routes/+page.svelte` (Main UI implementation)
  - `src/web-svelte/src/lib/utils/ema.ts` (Migrated client-side EMA logic)
  - `src/web-svelte/src/lib/components/` (New components for tooltips, tutorial, stock grid)
  - `src/web-static/` (To be safely removed)

---

## Implementation Steps

### Phase 1: Database Setup and Migration (Existing)
1. **Create Shared Database Module** (`src/db/database.py`) with `get_db_connection()` and schema initialization for `daily_prices`.
2. **Create Migration Script** (`scripts/migrate-csv-to-sqlite.py`) to move `data/*.csv` into SQLite.
3. **Refactor Scraper & Sync** to insert directly into SQLite.
4. **Refactor Backend** to query SQLite dynamically instead of loading all CSVs into pandas at startup.

### Phase 2: Frontend Consolidation (SvelteKit as Primary)
1. **Install Static Adapter:** Switch the SvelteKit app to use `@sveltejs/adapter-static`.
2. **Migrate Client-Side Logic:** Extract the standalone CSV/JSON parsing, EMA calculation, and sparkline generation logic currently in `web-static/index.html` into reusable Svelte utility functions (`src/lib/utils/ema.ts`).
3. **Decouple from Backend:** Ensure the SvelteKit app can fetch and process data directly, making the FastAPI backend entirely optional.
4. **Cleanup:** Safely remove the `web-static` directory.

### Phase 3: Core UI/UX Overhaul (Intuitive Design)
1. **Visual Hierarchy & Empty States:** 
   - Display a beautifully illustrated or clearly formatted empty state when no stocks are selected, with a call-to-action pointing to the search bar.
   - Use clear, descriptive labels (e.g., "EMA Trend (90-day)").
2. **Redesigned Stock Grid:**
   - Migrate the compact, data-rich table view from the static version into a reusable Svelte component.
   - Refine the color palette (Green/Red/Orange) to be modern, softer, and accessible.
3. **Context Cues:** Add subtle `ℹ️` (info) icons next to complex column headers.

### Phase 4: Smart Tooltips (Long Hover)
1. **Custom Svelte Action:** Create a `use:tooltip` action that triggers only after a ~500ms hover delay to prevent annoying flashing during mouse movement.
2. **Implementation:** Apply these tooltips to jargon like "Deviation", "Range Position", and the "EMA +/-" buttons with simple, human-readable explanations (e.g., *"Deviation: How far the current price is from the average EMA."*).

### Phase 5: Interactive Onboarding Explainer (The Tutorial)
1. **Integration:** Implement a lightweight interactive tutorial (e.g., using a library like Driver.js or a custom Svelte overlay).
2. **The Experience:** It will dim the background (lower opacity) and highlight specific UI elements one by one with a popover containing **Skip** (left) and **Next** (right) buttons.
3. **The Steps:**
   - **Step 1 (Search):** Highlights the Add Stock input. *"Start here! Search and add NEPSE stocks to your watchlist."*
   - **Step 2 (EMA Period):** Highlights the EMA +/- buttons. *"Adjust your trading window. 90 days is standard, but you can tweak it to your strategy."*
   - **Step 3 (Status):** Highlights the stock list area. *"Instantly see if a stock is breaking out (Above), falling (Below), or consolidating (Within) its moving average."*
4. **Triggers:** Auto-start for first-time users (tracked via `localStorage`), and a persistent **"❓ Help"** button in the top navigation bar to manually replay the tutorial at any time.

## Verification & Testing
1. Verify the SvelteKit app builds statically via `npm run build` without relying on a Node.js server.
2. Confirm that EMA logic correctly executes in the browser.
3. Validate that tooltips only appear after the intentional 500ms delay.
4. Open the app in an Incognito window to verify the auto-start of the explainer tutorial.
5. Click the "Help" button to ensure the tutorial can be manually retriggered.
6. Verify `web-static` is fully deprecated and its features are completely ported.