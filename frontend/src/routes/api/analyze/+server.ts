import { json } from '@sveltejs/kit';
import { getSymbolData } from '$lib/dataLoader';
import { analyzeStock } from '$lib/ema';
import type { RequestHandler } from './$types';

interface AnalyzeRequest {
	symbols: string[];
	ema_period: number;
	date?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as AnalyzeRequest;
	const { symbols, ema_period, date } = body;

	const results = [];

	for (const symbol of symbols) {
		const stockData = await getSymbolData(symbol);

		if (stockData.length === 0) {
			results.push({
				symbol,
				error: 'No data found'
			});
			continue;
		}

		const analysis = analyzeStock(stockData, ema_period, date);

		if (analysis) {
			results.push(analysis);
		} else {
			results.push({
				symbol,
				error: 'No data found for the specified date'
			});
		}
	}

	return json({
		results,
		ema_period,
		date: date || null
	});
};
