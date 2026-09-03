import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeStock, type PriceRecord } from './wma.ts';

export interface DataFile {
    symbols: string[];
    prices: Record<string, PriceRecord[]>;
    last_updated: string;
}

const BACKEND_DIR = dirname(fileURLToPath(import.meta.url));

const DATA_FILE =
    process.env.DATA_FILE ?? join(BACKEND_DIR, '..', '..', 'frontend', 'static', 'data.json');

let cache: DataFile | null = null;
let cacheMtime = 0;

async function loadData(): Promise<DataFile> {
    try {
        const { mtimeMs } = await stat(DATA_FILE);
        if (cache && mtimeMs === cacheMtime) return cache;
        const raw = await readFile(DATA_FILE, 'utf-8');
        cache = JSON.parse(raw) as DataFile;
        cacheMtime = mtimeMs;
        return cache;
    } catch {
        throw new Error(`Data file not found: ${DATA_FILE} (run "npm run fetch-data" first)`);
    }
}

export const app = new Hono();

app.use('*', cors());

app.get('/', (c) => c.json({ message: 'NEPSE Scanner API' }));

app.get('/health', (c) => c.json({ ok: true }));

app.get('/symbols', async (c) => {
    try {
        const data = await loadData();
        return c.json({ symbols: data.symbols });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
    }
});

const REFRESH_TOKEN = process.env.REFRESH_TOKEN ?? '';
const REPO_ROOT = join(BACKEND_DIR, '..', '..');
const REFRESH_MIN_INTERVAL_MS = 30_000;
let refreshing = false;
let lastRefreshAt = 0;

function run(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, args, { cwd: REPO_ROOT });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
        child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
        child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    });
}

async function runRefresh(): Promise<{ source: string; log: string }> {
    const nodeBin = process.execPath;
    const primary = await run(nodeBin, ['scripts/scrape-today.ts']);
    if (primary.code === 0) return { source: 'scrape', log: primary.stdout };
    const backup = await run(nodeBin, ['scripts/fetch-data.ts']);
    if (backup.code === 0) return { source: 'mirror', log: backup.stdout };
    throw new Error(
        `Scrape and mirror backup both failed.\nscrape:\n${primary.stderr}\nbackup:\n${backup.stderr}`
    );
}

app.post('/refresh', async (c) => {
    if (!REFRESH_TOKEN || c.req.header('X-Refresh-Token') !== REFRESH_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    if (refreshing) {
        return c.json({ error: 'Refresh already in progress' }, 409);
    }
    const now = Date.now();
    if (now - lastRefreshAt < REFRESH_MIN_INTERVAL_MS) {
        return c.json({ error: 'Refresh too soon, try again in a moment.' }, 429);
    }

    refreshing = true;
    try {
        const result = await runRefresh();
        cache = null; // force data.json to be re-read from disk
        const data = await loadData();
        return c.json({ ok: true, ...result, last_updated: data.last_updated });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
    } finally {
        refreshing = false;
        lastRefreshAt = Date.now();
    }
});

app.post('/analyze', async (c) => {
    try {
        const body = await c.req.json();
        const symbols: string[] = Array.isArray(body.symbols) ? body.symbols : [];
        const period: number = Number(body.wma_period ?? body.ema_period ?? body.period) || 90;
        const date: string | undefined = body.date || undefined;

        const data = await loadData();

        const results = symbols.map((symbol) => {
            const allPrices = data.prices[symbol] ?? [];
            const prices = date ? allPrices.filter((p) => p.date <= date) : allPrices;

            const analysis = analyzeStock(symbol, prices, period);
            return analysis ?? { symbol, error: 'No data found' };
        });

        return c.json({ results, wma_period: period, date: date ?? null });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
    }
});

app.post('/screener', async (c) => {
    try {
        const body = await c.req.json();
        const period: number = Number(body.wma_period ?? body.ema_period ?? body.period) || 90;
        const date: string | undefined = body.date || undefined;

        const data = await loadData();

        const results = data.symbols
            .map((symbol) => {
                const allPrices = data.prices[symbol] ?? [];
                const prices = date ? allPrices.filter((p) => p.date <= date) : allPrices;
                return analyzeStock(symbol, prices, period);
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

        return c.json({
            results,
            wma_period: period,
            date: date ?? null,
            total: results.length,
            last_updated: data.last_updated
        });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
    }
});

export default app;