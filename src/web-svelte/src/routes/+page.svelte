<script lang="ts">
	import { onMount } from 'svelte';
	import { driver } from 'driver.js';
	import 'driver.js/dist/driver.css';
	import { tooltip } from '$lib/actions/tooltip';
	import { analyzeStock, type EMAResult, type PriceRecord } from '$lib/utils/ema';

	const API_URL = '/api';

	let emaPeriod = $state(90);
	let selectedDate = $state('2024-12-31');
	let selectedStocks = $state<string[]>(['NABIL', 'ADBL', 'UPPER', 'NICA']);
	let allSymbols = $state<string[]>([]);
	let analysisResults = $state<EMAResult[]>([]);
	let loading = $state(false);
	let lastUpdate = $state('');
	let offlineMode = $state(false);
	let fallbackData = $state<{ prices: Record<string, PriceRecord[]> } | null>(null);

	async function loadSymbols() {
		try {
			const response = await fetch(`${API_URL}/symbols`);
			if (!response.ok) throw new Error('Backend unreachable');
			const data = await response.json();
			allSymbols = data.symbols;
			offlineMode = false;
		} catch (error) {
			console.warn('Backend unreachable, switching to offline mode');
			await loadFallbackData();
		}
	}

	async function loadFallbackData() {
		try {
			const response = await fetch('/data.json');
			if (!response.ok) throw new Error('Fallback data not found');
			const data = await response.json();
			fallbackData = data;
			allSymbols = data.symbols;
			lastUpdate = data.last_updated;
			offlineMode = true;
		} catch (error) {
			console.error('Failed to load fallback data:', error);
		}
	}

	async function updateAnalysis() {
		if (selectedStocks.length === 0) {
			analysisResults = [];
			return;
		}

		loading = true;

		try {
			if (offlineMode && fallbackData) {
				const results: EMAResult[] = [];
				for (const symbol of selectedStocks) {
					const prices = fallbackData.prices[symbol];
					const analysis = analyzeStock(symbol, prices, emaPeriod);
					if (analysis) results.push(analysis);
				}
				analysisResults = results;
			} else {
				const response = await fetch(`${API_URL}/analyze`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						symbols: selectedStocks,
						ema_period: emaPeriod,
						date: selectedDate
					})
				});

				if (!response.ok) throw new Error('API request failed');

				const data = await response.json();
				// The API returns EMA results, but we want to add sparkline data which the API might not provide
				// For now, let's use the API results directly and if we need sparklines we might need to fetch history
				analysisResults = data.results;
				if (data.results.length > 0) {
					lastUpdate = data.results[0].last_updated;
				}
			}
		} catch (error) {
			console.error('Error analyzing stocks:', error);
			// If online failed, try offline
			if (!offlineMode) {
				await loadFallbackData();
				await updateAnalysis();
			}
		} finally {
			loading = false;
		}
	}

	function startTutorial() {
		const tutorialDriver = driver({
			showProgress: true,
			steps: [
				{
					element: '.add-stock',
					popover: {
						title: 'Add Stocks',
						description: 'Start here! Search and add NEPSE stocks to your watchlist.',
						side: 'top',
						align: 'start'
					}
				},
				{
					element: '.ema-control',
					popover: {
						title: 'EMA Period',
						description:
							'Adjust your trading window. 90 days is standard, but you can tweak it to your strategy.',
						side: 'bottom',
						align: 'center'
					}
				},
				{
					element: '.stock-list',
					popover: {
						title: 'Market Status',
						description:
							'Instantly see if a stock is breaking out (Above), falling (Below), or consolidating (Within) its moving average.',
						side: 'top',
						align: 'center'
					}
				}
			],
			onCloseClick: () => cleanupTutorial(),
			onDestroyed: () => cleanupTutorial()
		});

		// Step 0: Auto-add sample if empty
		let addedSample = false;
		if (selectedStocks.length === 0) {
			selectedStocks = ['NABIL'];
			addedSample = true;
		}

		function cleanupTutorial() {
			if (addedSample) {
				selectedStocks = selectedStocks.filter((s) => s !== 'NABIL');
			}
			localStorage.setItem('nepse_tutorial_seen', 'true');
		}

		tutorialDriver.drive();
	}

	function addStock(symbol: string) {
		if (symbol && !selectedStocks.includes(symbol)) {
			selectedStocks = [...selectedStocks, symbol];
		}
	}

	function removeStock(symbol: string) {
		selectedStocks = selectedStocks.filter((s) => s !== symbol);
	}

	function incrementEma() {
		emaPeriod = Math.min(200, emaPeriod + 1);
	}

	function decrementEma() {
		emaPeriod = Math.max(1, emaPeriod - 1);
	}

	$effect(() => {
		emaPeriod;
		selectedDate;
		selectedStocks;
		updateAnalysis();
	});

	onMount(() => {
		loadSymbols().then(() => {
			if (!localStorage.getItem('nepse_tutorial_seen')) {
				startTutorial();
			}
		});
	});
</script>

<div class="app-container">
	<header class="main-header">
		<div class="logo-area">
			<h1>📈 NEPSE EMA Scanner</h1>
			{#if offlineMode}
				<span class="badge offline">Offline Mode</span>
			{/if}
		</div>

		<div class="header-actions">
			<button class="help-btn" onclick={startTutorial}>❓ Help</button>
			<div class="ema-control" use:tooltip={'Adjust the EMA calculation period (days)'}>
				<button class="ema-btn" onclick={decrementEma}>−</button>
				<span class="ema-value">{emaPeriod}d EMA</span>
				<button class="ema-btn" onclick={incrementEma}>+</button>
			</div>
			<input type="date" bind:value={selectedDate} class="date-picker" />
		</div>
	</header>

	<main class="content">
		{#if selectedStocks.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📊</div>
				<h2>No stocks in your watchlist</h2>
				<p>Use the search box below to add stocks and start tracking EMA trends.</p>
				<div class="arrow-hint">↓</div>
			</div>
		{/if}

		<div class="stock-list" class:loading>
			{#each analysisResults as stock (stock.symbol)}
				<div class="stock-card {stock.status}">
					<div class="card-main">
						<div class="stock-info">
							<span class="symbol">{stock.symbol}</span>
							<span class="status-badge {stock.status}">
								{stock.status.toUpperCase()}
							</span>
						</div>
						<div class="price-info">
							<span class="current-price">₨{stock.current_price}</span>
							<span
								class="deviation"
								class:positive={stock.deviation > 0}
								class:negative={stock.deviation < 0}
								use:tooltip={'Percentage deviation from the EMA range midpoint'}
							>
								{stock.deviation > 0 ? '+' : ''}{stock.deviation.toFixed(2)}%
							</span>
						</div>
					</div>

					<div class="card-details">
						<div class="ema-range" use:tooltip={'The range between EMA High and EMA Low'}>
							<span class="label">EMA Range</span>
							<span class="value">{stock.ema_low.toFixed(1)} — {stock.ema_high.toFixed(1)}</span>
						</div>
						<div class="trend-days">
							<span class="label">Trend Duration</span>
							<span class="value">{stock.days_in_status} days</span>
						</div>
						<button class="remove-btn" onclick={() => removeStock(stock.symbol)} title="Remove">
							✕
						</button>
					</div>

					<div class="progress-container" use:tooltip={'Position of price within the EMA channel'}>
						<div class="progress-bar">
							<div class="progress-fill" style="width: {stock.range_position}%"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="add-stock">
			<select
				class="stock-select"
				onchange={(e) => {
					const target = e.target as HTMLSelectElement;
					addStock(target.value);
					target.value = '';
				}}
			>
				<option value="">🔍 Search and add a stock symbol...</option>
				{#each allSymbols as symbol}
					{#if !selectedStocks.includes(symbol)}
						<option value={symbol}>{symbol}</option>
					{/if}
				{/each}
			</select>
		</div>
	</main>

	<footer class="main-footer">
		<span>Last updated: {lastUpdate}</span>
		<div class="footer-links">
			<a href="https://github.com/sbmagar13/nepse-ema-scanner" target="_blank">GitHub</a>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: #f8fafc;
		color: #1e293b;
	}

	:global(.custom-tooltip) {
		position: fixed;
		background: #1e293b;
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
		max-width: 200px;
		z-index: 10000;
		pointer-events: none;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transition: opacity 0.2s;
		opacity: 0;
		line-height: 1.4;
	}

	.app-container {
		max-width: 1000px;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.main-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 20px;
		background: white;
		border-bottom: 1px solid #e2e8f0;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		color: #0f172a;
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.badge {
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}

	.badge.offline {
		background: #fef3c7;
		color: #92400e;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.ema-control {
		display: flex;
		align-items: center;
		background: #f1f5f9;
		padding: 4px;
		border-radius: 8px;
	}

	.ema-btn {
		width: 32px;
		height: 32px;
		border: none;
		background: white;
		color: #64748b;
		border-radius: 6px;
		cursor: pointer;
		font-weight: bold;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.ema-value {
		padding: 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: #475569;
	}

	.date-picker {
		padding: 8px 12px;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		font-size: 14px;
		color: #475569;
	}

	.help-btn {
		background: none;
		border: 1px solid #e2e8f0;
		padding: 8px 12px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		color: #64748b;
	}

	.help-btn:hover {
		background: #f8fafc;
	}

	.content {
		padding: 32px 20px;
		flex: 1;
	}

	.empty-state {
		text-align: center;
		padding: 64px 20px;
		color: #64748b;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.arrow-hint {
		font-size: 32px;
		margin-top: 24px;
		animation: bounce 2s infinite;
	}

	@keyframes bounce {
		0%,
		20%,
		50%,
		80%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-10px);
		}
		60% {
			transform: translateY(-5px);
		}
	}

	.stock-list {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
		margin-bottom: 32px;
	}

	.stock-card {
		background: white;
		border-radius: 12px;
		padding: 20px;
		border: 1px solid #e2e8f0;
		transition: all 0.2s;
	}

	.stock-card:hover {
		border-color: #cbd5e1;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
	}

	.card-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.stock-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.symbol {
		font-size: 18px;
		font-weight: 700;
		color: #0f172a;
	}

	.status-badge {
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 700;
		width: fit-content;
	}

	.status-badge.above {
		background: #e8f5e9;
		color: #2e7d32;
	}
	.status-badge.below {
		background: #ffebee;
		color: #c62828;
	}
	.status-badge.within {
		background: #fff3e0;
		color: #ef6c00;
	}

	.price-info {
		text-align: right;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.current-price {
		font-size: 20px;
		font-weight: 700;
		color: #0f172a;
	}

	.deviation {
		font-size: 13px;
		font-weight: 600;
	}

	.deviation.positive {
		color: #2e7d32;
	}
	.deviation.negative {
		color: #c62828;
	}

	.card-details {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 24px;
		padding: 16px 0;
		border-top: 1px solid #f1f5f9;
		align-items: center;
	}

	.label {
		display: block;
		font-size: 11px;
		text-transform: uppercase;
		color: #94a3b8;
		letter-spacing: 0.05em;
		margin-bottom: 4px;
	}

	.value {
		font-size: 14px;
		font-weight: 600;
		color: #475569;
	}

	.remove-btn {
		background: none;
		border: none;
		color: #cbd5e1;
		cursor: pointer;
		padding: 8px;
		font-size: 16px;
		transition: color 0.2s;
	}

	.remove-btn:hover {
		color: #ef4444;
	}

	.progress-container {
		margin-top: 8px;
	}

	.progress-bar {
		height: 6px;
		background: #f1f5f9;
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #94a3b8;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.stock-card.above .progress-fill {
		background: #2e7d32;
	}
	.stock-card.below .progress-fill {
		background: #c62828;
	}
	.stock-card.within .progress-fill {
		background: #ef6c00;
	}

	.add-stock {
		background: white;
		border: 2px dashed #e2e8f0;
		border-radius: 12px;
		padding: 12px;
	}

	.stock-select {
		width: 100%;
		border: none;
		padding: 12px;
		font-size: 15px;
		background: transparent;
		color: #475569;
		cursor: pointer;
		outline: none;
	}

	.main-footer {
		padding: 24px 20px;
		border-top: 1px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: #94a3b8;
	}

	.footer-links a {
		color: #64748b;
		text-decoration: none;
	}

	.footer-links a:hover {
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.header-actions {
			gap: 8px;
		}
		.ema-value {
			display: none;
		}
		.card-details {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.remove-btn {
			grid-row: 1;
			grid-column: 1;
			justify-self: end;
		}
	}
</style>
