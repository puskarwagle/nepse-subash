<script lang="ts">
	import { onMount } from 'svelte';

	const API_URL = '/api';

	let emaPeriod = $state(90);
	let selectedDate = $state('2024-12-31');
	let selectedStocks = $state(['NABIL', 'ADBL', 'UPPER', 'NICA']);
	let allSymbols = $state<string[]>([]);
	let analysisResults = $state<Map<string, any>>(new Map());
	let loading = $state(false);
	let lastUpdate = $state('');

	// Derived array from Map for rendering
	let stockList = $derived(Array.from(analysisResults.values()));

	// Auto-update when dependencies change
	let updateTimeout: ReturnType<typeof setTimeout> | null = null;

	// Debounced effect - only update after user stops changing values
	$effect(() => {
		emaPeriod;
		selectedDate;
		selectedStocks;

		console.log('$effect triggered. selectedStocks:', selectedStocks);

		if (updateTimeout) {
			clearTimeout(updateTimeout);
		}

		if (selectedStocks.length > 0) {
			console.log('Scheduling updateAnalysis...');
			updateTimeout = setTimeout(() => {
				updateAnalysis();
			}, 300); // 300ms debounce
		} else {
			analysisResults = new Map();
		}
	});

	async function loadSymbols() {
		try {
			const response = await fetch(`${API_URL}/symbols`);
			const data = await response.json();
			allSymbols = data.symbols;
		} catch (error) {
			console.error('Error loading symbols:', error);
		}
	}

	async function updateAnalysis() {
		console.log('updateAnalysis called with stocks:', selectedStocks);

		if (selectedStocks.length === 0) {
			console.log('No stocks, returning early');
			analysisResults = new Map();
			return;
		}

		console.log('Setting loading = true');
		loading = true;

		console.log('Entering try block');
		try {
			const payload: any = {
				symbols: selectedStocks,
				ema_period: emaPeriod
			};

			if (selectedDate) {
				payload.date = selectedDate;
			}

			console.log('Fetching API with payload:', payload);

			const response = await fetch(`${API_URL}/analyze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			console.log('API response status:', response.status);

			if (!response.ok) {
				throw new Error(`API returned ${response.status}: ${await response.text()}`);
			}

			const data = await response.json();
			console.log('API response data:', data);

			// Create new Map with results - Svelte 5 needs new object reference
			const newMap = new Map(analysisResults);
			for (const result of data.results) {
				newMap.set(result.symbol, result);
			}
			analysisResults = newMap;
			console.log('Updated analysisResults, size:', analysisResults.size);

			if (data.results.length > 0) {
				lastUpdate = data.results[0].last_updated;
			}
		} catch (error) {
			console.error('Error analyzing stocks:', error);
			console.error('Error details:', error);
			alert(`Error: ${error}`);
		} finally {
			loading = false;
			console.log('updateAnalysis finished, loading:', loading);
		}
	}

	function addStock(symbol: string) {
		console.log('addStock called with:', symbol);
		console.log('current selectedStocks:', selectedStocks);
		if (symbol && !selectedStocks.includes(symbol)) {
			selectedStocks = [...selectedStocks, symbol];
			console.log('updated selectedStocks:', selectedStocks);
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

	onMount(() => {
		loadSymbols();
	});
</script>

<div class="container">
	<div class="header">
		<h1>NEPSE EMA Scanner</h1>

		<div class="controls">
			<!-- EMA Control -->
			<div class="ema-control">
				<button class="ema-btn" onclick={decrementEma}>−</button>
				<span class="ema-value">{emaPeriod}</span>
				<button class="ema-btn" onclick={incrementEma}>+</button>
			</div>

			<!-- Date Picker -->
			<div class="date-picker-wrapper">
				<input
					type="date"
					bind:value={selectedDate}
					min="2022-01-01"
					max="2024-12-31"
					class="date-picker"
				/>
			</div>
		</div>
	</div>

	<div class="content">
		<!-- Stock List -->
		<div class="stock-list">
			{#if stockList.length === 0 && !loading}
				<div class="empty-state">
					<p>No stocks selected</p>
					<p style="font-size: 14px;">Add stocks from the dropdown below</p>
				</div>
			{/if}

			{#each stockList as stock (stock.symbol)}
				<div class="stock-item {stock.status}" class:loading>
					<input
						type="checkbox"
						class="checkbox"
						checked
						onchange={() => removeStock(stock.symbol)}
					/>
					<div class="stock-symbol">{stock.symbol}</div>
					<div class="stock-status">
						<span class="status-icon">
							{#if stock.status === 'above'}↑{:else if stock.status === 'below'}↓{:else}→{/if}
						</span>
						<span>
							{#if stock.status === 'above'}Above{:else if stock.status === 'below'}Below{:else}Within{/if}
						</span>
						<span class="stock-price">{stock.current_price}</span>
					</div>
					<div class="stock-range">EMA: {stock.ema_low} - {stock.ema_high}</div>
				</div>
			{/each}
		</div>

		<!-- Add Stock -->
		<div class="add-stock">
			<select
				class="stock-select"
				onchange={(e) => {
					const target = e.target as HTMLSelectElement;
					addStock(target.value);
					target.value = '';
				}}
			>
				<option value="">Select a stock...</option>
				{#each allSymbols as symbol}
					{#if !selectedStocks.includes(symbol)}
						<option value={symbol}>{symbol}</option>
					{/if}
				{/each}
			</select>
		</div>
	</div>

	<div class="footer">Last updated: {lastUpdate}</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 20px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
		background: #f5f5f5;
		color: #333;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 30px;
		border-bottom: 1px solid #e0e0e0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	h1 {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.ema-control {
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(255, 255, 255, 0.15);
		padding: 6px 12px;
		border-radius: 8px;
	}

	.ema-btn {
		width: 32px;
		height: 32px;
		background: rgba(255, 255, 255, 0.9);
		color: #667eea;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 700;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.ema-btn:hover {
		background: white;
		transform: scale(1.05);
	}

	.ema-btn:active {
		transform: scale(0.95);
	}

	.ema-value {
		min-width: 40px;
		padding: 6px;
		font-size: 16px;
		font-weight: 600;
		color: white;
		text-align: center;
	}

	.date-picker-wrapper {
		position: relative;
		cursor: pointer;
	}

	.date-picker {
		padding: 8px 12px;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		background: rgba(255, 255, 255, 0.9);
		cursor: pointer;
		min-width: 150px;
	}

	.date-picker::-webkit-calendar-picker-indicator {
		cursor: pointer;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: auto;
		height: auto;
		color: transparent;
		background: transparent;
	}

	.date-picker:hover {
		background: white;
	}

	.content {
		padding: 30px;
	}

	.stock-list {
		margin-bottom: 30px;
		min-height: 100px;
	}

	.stock-item {
		display: flex;
		align-items: center;
		padding: 16px 20px;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		margin-bottom: 12px;
	}

	.stock-item.loading {
		opacity: 0.6;
		pointer-events: none;
	}

	.stock-item:hover {
		border-color: #667eea;
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
	}

	.stock-item.above {
		border-color: #4caf50;
		background: #f1f8f4;
	}

	.stock-item.below {
		border-color: #f44336;
		background: #fef1f0;
	}

	.stock-item.within {
		border-color: #ff9800;
		background: #fff8f0;
	}

	.checkbox {
		margin-right: 16px;
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.stock-symbol {
		font-weight: 600;
		font-size: 16px;
		width: 120px;
	}

	.stock-status {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
	}

	.status-icon {
		font-size: 18px;
	}

	.stock-price {
		font-weight: 600;
		margin-left: 8px;
	}

	.stock-range {
		color: #666;
		font-size: 14px;
		margin-left: auto;
	}

	.add-stock {
		padding: 20px;
		background: #f9f9f9;
		border-radius: 8px;
	}

	.stock-select {
		width: 100%;
		padding: 10px 14px;
		border: 2px solid #e0e0e0;
		border-radius: 6px;
		font-size: 15px;
		cursor: pointer;
	}

	.footer {
		padding: 16px 30px;
		border-top: 1px solid #e0e0e0;
		background: #fafafa;
		color: #666;
		font-size: 13px;
		text-align: center;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: #999;
	}

	.empty-state p {
		margin: 0;
		font-size: 16px;
	}
</style>
