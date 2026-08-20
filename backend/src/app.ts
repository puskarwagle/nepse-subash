import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeStock, type PriceRecord } from './ema.ts';

export interface DataFile {
    symbols: string[];
    prices: Record<string, PriceRecord[]>;
    last_updated: string;
}

const DATA_FILE =
    process.env.DATA_FILE ?? join(import.meta.dir, '..', '..', 'frontend', 'static', 'data.json');

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
        throw new Error(`Data file not found: ${DATA_FILE} (run "bun run fetch-data" first)`);
    }
}

export const app = new Hono();

app.use('*', cors());

app.get('/', (c) => c.json({ message: 'NEPSE EMA Scanner API' }));

app.get('/health', (c) => c.json({ ok: true }));

app.get('/symbols', async (c) => {
    try {
        const data = await loadData();
        return c.json({ symbols: data.symbols });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
    }
});

app.post('/analyze', async (c) => {
    try {
        const body = await c.req.json();
        const symbols: string[] = Array.isArray(body.symbols) ? body.symbols : [];
        const period: number = Number(body.ema_period) || 90;
        const date: string | undefined = body.date || undefined;

        const data = await loadData();

        const results = symbols.map((symbol) => {
            const allPrices = data.prices[symbol] ?? [];
            const prices = date ? allPrices.filter((p) => p.date <= date) : allPrices;

            const analysis = analyzeStock(symbol, prices, period);
            return analysis ?? { symbol, error: 'No data found' };
        });

        return c.json({ results, ema_period: period, date: date ?? null });
    } catch (error) {
        return c.json({ error: (error as Error).message }, 500);
    }
});

export default app;