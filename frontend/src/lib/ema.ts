// EMA calculation utilities

export interface StockData {
	Symbol: string;
	Date: Date;
	Open: number;
	High: number;
	Low: number;
	Close: number;
}

export interface AnalysisResult {
	symbol: string;
	current_price: number;
	ema_high: number;
	ema_low: number;
	status: 'above' | 'below' | 'within';
	last_updated: string;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(values: number[], period: number): number[] {
	if (values.length === 0) return [];
	if (values.length < period) return []; // Need at least 'period' values

	const multiplier = 2 / (period + 1);
	const ema: number[] = new Array(values.length);

	// First EMA is SMA of first 'period' values
	let sum = 0;
	for (let i = 0; i < period; i++) {
		sum += values[i];
	}
	ema[period - 1] = sum / period;

	// Calculate subsequent EMAs
	for (let i = period; i < values.length; i++) {
		ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
	}

	return ema;
}

/**
 * Analyze stock against EMA range
 */
export function analyzeStock(
	stockData: StockData[],
	period: number,
	targetDate?: string
): AnalysisResult | null {
	if (stockData.length === 0) return null;

	// Filter by date if specified
	let filteredData = stockData;
	if (targetDate) {
		const target = new Date(targetDate);
		filteredData = stockData.filter((d) => d.Date <= target);
	}

	if (filteredData.length === 0) return null;

	// Calculate EMAs
	const highs = filteredData.map((d) => d.High);
	const lows = filteredData.map((d) => d.Low);

	const emaHigh = calculateEMA(highs, period);
	const emaLow = calculateEMA(lows, period);

	// Check if EMA calculation succeeded
	if (emaHigh.length === 0 || emaLow.length === 0) {
		return null; // Not enough data for the given period
	}

	// Get latest values
	const latest = filteredData[filteredData.length - 1];
	const currentPrice = latest.Close;
	const latestEmaHigh = emaHigh[emaHigh.length - 1];
	const latestEmaLow = emaLow[emaLow.length - 1];

	// Determine status
	let status: 'above' | 'below' | 'within';
	if (currentPrice > latestEmaHigh) {
		status = 'above';
	} else if (currentPrice < latestEmaLow) {
		status = 'below';
	} else {
		status = 'within';
	}

	return {
		symbol: latest.Symbol,
		current_price: Math.round(currentPrice * 100) / 100,
		ema_high: Math.round(latestEmaHigh * 100) / 100,
		ema_low: Math.round(latestEmaLow * 100) / 100,
		status,
		last_updated: latest.Date.toISOString().split('T')[0]
	};
}
