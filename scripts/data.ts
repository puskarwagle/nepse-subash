import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PriceRecord {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface RowRecord extends PriceRecord {
    symbol: string;
}

export interface DataFile {
    symbols: string[];
    prices: Record<string, PriceRecord[]>;
    last_updated: string;
}

const DATA_FILE = join(import.meta.dir, '..', 'frontend', 'static', 'data.json');

const NUMERIC_COLUMNS = ['Open', 'High', 'Low', 'Close'];
const VOLUME_COLUMNS = ['Vol.', 'Vol', 'Volume'];

export function dataFilePath(): string {
    return DATA_FILE;
}

export async function loadData(): Promise<DataFile> {
    try {
        const raw = await readFile(DATA_FILE, 'utf-8');
        return JSON.parse(raw) as DataFile;
    } catch {
        return { symbols: [], prices: {}, last_updated: '' };
    }
}

export async function saveData(data: DataFile): Promise<void> {
    await writeFile(DATA_FILE, JSON.stringify(data));
}

/** Parse CSV text into rows of cells, handling double-quoted fields (e.g. "1,011.00"). */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
}

function toNumber(value: string): number {
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
}

/** Convert a CSV row into a PriceRecord using the header row for column positions. */
export function rowToPriceRecord(header: string[], cells: string[], date: string): RowRecord | null {
    const column = (names: string[]) => {
        const index = header.findIndex((h) => names.includes(h.trim()));
        return index === -1 ? -1 : index;
    };

    const symbolIndex = column(['Symbol']);
    if (symbolIndex === -1 || !cells[symbolIndex]?.trim()) return null;

    const volumeIndex = column(VOLUME_COLUMNS);
    const pick = (names: string[]) => {
        const index = column(names);
        return index === -1 || index >= cells.length ? 0 : toNumber(cells[index]);
    };

    return {
        date,
        symbol: cells[symbolIndex].trim(),
        open: pick(NUMERIC_COLUMNS.slice(0, 1)),
        high: pick(['High']),
        low: pick(['Low']),
        close: pick(['Close']),
        volume: volumeIndex === -1 || volumeIndex >= cells.length ? 0 : toNumber(cells[volumeIndex])
    };
}

/** Insert/replace records for a given date, skipping ones already stored. */
export function upsertRecords(data: DataFile, records: RowRecord[]): number {
    let inserted = 0;
    for (const record of records) {
        const { symbol, ...prices } = record;
        const arr = (data.prices[symbol] ??= []);
        const existing = arr.findIndex((p) => p.date === record.date);
        if (existing === -1) {
            arr.push(prices);
            inserted++;
        } else {
            arr[existing] = prices;
        }
    }
    return inserted;
}

/** Prune each symbol to its most recent N records, rebuild the symbol list, and set last_updated. */
export function refreshMeta(data: DataFile, keep = 120): void {
    for (const symbol of Object.keys(data.prices)) {
        const arr = data.prices[symbol].sort((a, b) => a.date.localeCompare(b.date));
        data.prices[symbol] = arr.slice(-keep).map(({ symbol: _drop, ...rest }) => rest);
    }

    const symbols = new Set(data.symbols);
    for (const symbol of Object.keys(data.prices)) symbols.add(symbol);
    data.symbols = [...symbols].sort();

    let latest = '';
    for (const arr of Object.values(data.prices)) {
        for (const r of arr) {
            if (r.date > latest) latest = r.date;
        }
    }
    data.last_updated = latest;
}