export interface PriceRecord {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface WMAResult {
    symbol: string;
    current_price: number;
    wma_high: number;
    wma_low: number;
    status: 'above' | 'below' | 'within';
    last_updated: string;
    deviation: number;
    range_position: number;
    days_in_status: number;
    sparkline_data: number[];
}

export function calculateWMA(values: number[], period: number): number[] {
    const n = values.length;
    if (n < period) return [];

    const wma = new Array<number>(n).fill(0);
    const weightSum = (period * (period + 1)) / 2;

    let weightedSum = 0;
    let windowSum = 0;
    for (let i = 0; i < period; i++) {
        weightedSum += values[i] * (i + 1);
        windowSum += values[i];
    }
    wma[period - 1] = weightedSum / weightSum;

    for (let i = period; i < n; i++) {
        weightedSum = weightedSum - windowSum + period * values[i];
        windowSum = windowSum - values[i - period] + values[i];
        wma[i] = weightedSum / weightSum;
    }

    return wma;
}

export function analyzeStock(symbol: string, prices: PriceRecord[], period: number): WMAResult | null {
    if (!prices || prices.length < period) return null;

    const sortedData = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const highs = sortedData.map((d) => d.high);
    const lows = sortedData.map((d) => d.low);
    const closes = sortedData.map((d) => d.close);

    const wmaHighs = calculateWMA(highs, period);
    const wmaLows = calculateWMA(lows, period);

    if (wmaHighs.length === 0) return null;

    const latest = sortedData[sortedData.length - 1];
    const latestWmaHigh = wmaHighs[wmaHighs.length - 1];
    const latestWmaLow = wmaLows[wmaLows.length - 1];

    let status: 'above' | 'below' | 'within';
    if (latest.close > latestWmaHigh) {
        status = 'above';
    } else if (latest.close < latestWmaLow) {
        status = 'below';
    } else {
        status = 'within';
    }

    const mid = (latestWmaHigh + latestWmaLow) / 2;
    const deviation = mid === 0 ? 0 : ((latest.close - mid) / mid) * 100;

    const span = latestWmaHigh - latestWmaLow;
    const range_position = span === 0 ? 50 : ((latest.close - latestWmaLow) / span) * 100;

    let days_in_status = 1;
    for (let i = sortedData.length - 2; i >= 0; i--) {
        const h = wmaHighs[i];
        const l = wmaLows[i];
        if (!h || !l) break;

        let s: 'above' | 'below' | 'within';
        if (sortedData[i].close > h) s = 'above';
        else if (sortedData[i].close < l) s = 'below';
        else s = 'within';

        if (s === status) {
            days_in_status++;
        } else {
            break;
        }
    }

    return {
        symbol,
        current_price: latest.close,
        wma_high: latestWmaHigh,
        wma_low: latestWmaLow,
        status,
        last_updated: latest.date,
        deviation,
        range_position: Math.max(0, Math.min(100, range_position)),
        days_in_status,
        sparkline_data: closes.slice(-30)
    };
}
