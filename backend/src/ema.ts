export interface PriceRecord {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface EMAResult {
    symbol: string;
    current_price: number;
    ema_high: number;
    ema_low: number;
    status: 'above' | 'below' | 'within';
    last_updated: string;
    deviation: number;
    range_position: number;
    days_in_status: number;
    sparkline_data: number[];
}

export function calculateEMA(values: number[], period: number): number[] {
    if (values.length < period) return [];

    const multiplier = 2 / (period + 1);
    const ema = new Array(values.length);

    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += values[i];
    }
    ema[period - 1] = sum / period;

    for (let i = period; i < values.length; i++) {
        ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
}

export function analyzeStock(symbol: string, prices: PriceRecord[], period: number): EMAResult | null {
    if (!prices || prices.length < period) return null;

    const sortedData = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const highs = sortedData.map((d) => d.high);
    const lows = sortedData.map((d) => d.low);
    const closes = sortedData.map((d) => d.close);

    const emaHighs = calculateEMA(highs, period);
    const emaLows = calculateEMA(lows, period);

    if (emaHighs.length === 0) return null;

    const latest = sortedData[sortedData.length - 1];
    const latestEmaHigh = emaHighs[emaHighs.length - 1];
    const latestEmaLow = emaLows[emaLows.length - 1];

    let status: 'above' | 'below' | 'within';
    if (latest.close > latestEmaHigh) {
        status = 'above';
    } else if (latest.close < latestEmaLow) {
        status = 'below';
    } else {
        status = 'within';
    }

    const emaMid = (latestEmaHigh + latestEmaLow) / 2;
    const deviation = ((latest.close - emaMid) / emaMid) * 100;

    const rangeSpan = latestEmaHigh - latestEmaLow;
    const range_position = rangeSpan === 0 ? 50 : ((latest.close - latestEmaLow) / rangeSpan) * 100;

    let days_in_status = 1;
    for (let i = sortedData.length - 2; i >= 0; i--) {
        const d = sortedData[i];
        const h = emaHighs[i];
        const l = emaLows[i];
        if (!h || !l) break;

        let s: 'above' | 'below' | 'within';
        if (d.close > h) s = 'above';
        else if (d.close < l) s = 'below';
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
        ema_high: latestEmaHigh,
        ema_low: latestEmaLow,
        status,
        last_updated: latest.date,
        deviation,
        range_position: Math.max(0, Math.min(100, range_position)),
        days_in_status,
        sparkline_data: closes.slice(-30)
    };
}