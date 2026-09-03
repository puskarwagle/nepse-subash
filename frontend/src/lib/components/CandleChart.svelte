<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
	import type { PriceRecord } from '$lib/utils/wma';

	interface Props {
		symbol: string;
		prices: PriceRecord[];
		theme?: 'light' | 'dark';
		height?: number;
	}

	let { symbol, prices, theme = 'dark', height = 340 }: Props = $props();

	let container: HTMLDivElement;
	const palette = $state({
		light: {
			up: '#26a69a',
			down: '#ef5350',
			border: '#d7ddec',
			grid: '#e6eaf2',
			text: '#6b7280',
			bg: '#ffffff'
		},
		dark: {
			up: '#81c784',
			down: '#ef9a9a',
			border: '#2a2e39',
			grid: '#2a2e39',
			text: '#94a3b8',
			bg: '#1e293b'
		}
	});

	let chart: IChartApi | null = null;
	let candleSeries: ISeriesApi<'Candlestick'> | null = null;
	let volumeSeries: ISeriesApi<'Histogram'> | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let disposed = false;

	function buildSeries() {
		if (!chart) return;
		const colors = palette[theme];

		candleSeries = chart.addSeries(CandlestickSeries, {
			upColor: colors.up,
			downColor: colors.down,
			borderUpColor: colors.up,
			borderDownColor: colors.down,
			wickUpColor: colors.up,
			wickDownColor: colors.down,
			priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
		});

		volumeSeries = chart.addSeries(HistogramSeries, {
			priceScaleId: '',
			priceFormat: { type: 'volume' }
		});
		chart.priceScale('').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

		updateData();
	}

	function updateData() {
		if (!candleSeries || !volumeSeries) return;

		const colors = palette[theme];
		const ordered = [...prices].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		const candles = ordered.map((p) => ({
			time: (new Date(p.date + 'T00:00:00').getTime() / 1000) as UTCTimestamp,
			open: p.open,
			high: p.high,
			low: p.low,
			close: p.close
		}));

		const volumes = ordered.map((p) => ({
			time: (new Date(p.date + 'T00:00:00').getTime() / 1000) as UTCTimestamp,
			value: p.volume,
			color: p.close >= p.open ? colors.up : colors.down
		}));

		candleSeries.setData(candles);
		volumeSeries.setData(volumes);
		chart?.timeScale().fitContent();
	}

	function applyTheme() {
		if (!chart) return;
		const colors = palette[theme];
		chart.applyOptions({
			layout: {
				background: { type: 1, color: colors.bg, transparent: false },
				textColor: colors.text,
				fontSize: 11
			},
			grid: {
				vertLines: { color: colors.grid },
				horzLines: { color: colors.grid }
			},
			rightPriceScale: { borderColor: colors.border },
			timeScale: { borderColor: colors.border, timeVisible: false }
		});
		if (candleSeries && volumeSeries) updateData();
	}

	onMount(() => {
		chart = createChart(container, {
			autoSize: false,
			width: container.clientWidth || 600,
			height,
			layout: {
				background: { type: 1, color: palette[theme].bg, transparent: false },
				textColor: palette[theme].text,
				fontSize: 11
			},
			grid: {
				vertLines: { color: palette[theme].grid },
				horzLines: { color: palette[theme].grid }
			},
			rightPriceScale: { borderColor: palette[theme].border },
			timeScale: { borderColor: palette[theme].border, timeVisible: false },
			crosshair: { mode: 0 }
		});

		buildSeries();

		resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry && chart) {
				chart.applyOptions({ width: entry.contentRect.width });
			}
		});
		if (container) resizeObserver.observe(container);
	});

	$effect(() => {
		symbol;
		theme;
		height;
		if (chart && candleSeries && volumeSeries) {
			chart.applyOptions({ height });
			applyTheme();
			updateData();
		}
	});

	onDestroy(() => {
		disposed = true;
		resizeObserver?.disconnect();
		if (chart) {
			chart.remove();
			chart = null;
		}
	});
</script>

<div class="candle-chart" style="height:{height}px">
	<div class="chart-title">
		<span class="chart-symbol">{symbol}</span>
		<span class="chart-range">OHLC</span>
	</div>
	<div class="chart-container" bind:this={container} aria-label="{symbol} candlestick chart"></div>
</div>

<style>
	.candle-chart {
		display: flex;
		flex-direction: column;
		width: 100%;
	}
	.chart-title {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 2px 6px;
	}
	.chart-symbol {
		font-size: 14px;
		font-weight: 800;
		color: var(--text-strong);
		letter-spacing: 0.02em;
	}
	.chart-range {
		font-size: 11px;
		color: var(--text-faint);
	}
	.chart-container {
		flex: 1;
		width: 100%;
		min-height: 0;
	}
</style>