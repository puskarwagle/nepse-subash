import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { StockData } from './ema';

const DATA_DIR = join(process.cwd(), '..', 'data');

let cachedData: Map<string, StockData[]> | null = null;

/**
 * Clean numeric values from CSV (remove commas)
 */
function cleanNumeric(value: string): number {
	const cleaned = value.replace(/,/g, '').trim();
	const num = parseFloat(cleaned);
	return isNaN(num) ? 0 : num;
}

/**
 * Parse a single CSV file
 */
async function parseCSVFile(filePath: string, dateStr: string): Promise<StockData[]> {
	const content = await readFile(filePath, 'utf-8');
	const lines = content.split('\n').filter((line) => line.trim());

	// Skip header
	const dataLines = lines.slice(1);

	const stocks: StockData[] = [];
	const date = new Date(dateStr);

	for (const line of dataLines) {
		const parts = line.split(',');
		if (parts.length < 6) continue;

		try {
			stocks.push({
				Symbol: parts[0],
				Date: date,
				Open: cleanNumeric(parts[2]),
				High: cleanNumeric(parts[3]),
				Low: cleanNumeric(parts[4]),
				Close: cleanNumeric(parts[5])
			});
		} catch (e) {
			// Skip malformed rows
			continue;
		}
	}

	return stocks;
}

/**
 * Load all CSV files and combine
 */
export async function loadAllData(): Promise<Map<string, StockData[]>> {
	if (cachedData) return cachedData;

	console.log('Loading historical data...');

	const files = await readdir(DATA_DIR);
	const csvFiles = files.filter((f) => f.endsWith('.csv')).sort();

	const stockMap = new Map<string, StockData[]>();

	for (const file of csvFiles) {
		// Parse date from filename: MM_DD_YYYY.csv
		const [month, day, year] = file.replace('.csv', '').split('_');
		const dateStr = `${year}-${month}-${day}`;

		const filePath = join(DATA_DIR, file);
		const stocks = await parseCSVFile(filePath, dateStr);

		for (const stock of stocks) {
			if (!stockMap.has(stock.Symbol)) {
				stockMap.set(stock.Symbol, []);
			}
			stockMap.get(stock.Symbol)!.push(stock);
		}
	}

	// Sort each stock's data by date
	for (const [symbol, data] of stockMap.entries()) {
		data.sort((a, b) => a.Date.getTime() - b.Date.getTime());
	}

	console.log(`Loaded data for ${stockMap.size} symbols`);
	cachedData = stockMap;
	return stockMap;
}

/**
 * Get all available symbols
 */
export async function getSymbols(): Promise<string[]> {
	const data = await loadAllData();
	return Array.from(data.keys()).sort();
}

/**
 * Get data for a specific symbol
 */
export async function getSymbolData(symbol: string): Promise<StockData[]> {
	const data = await loadAllData();
	return data.get(symbol) || [];
}
