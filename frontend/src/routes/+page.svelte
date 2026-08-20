<script lang="ts">
	import { onMount } from 'svelte';
	import { analyzeStock, type PriceRecord, type WMAResult } from '$lib/utils/wma';

	type Filter = 'all' | 'above' | 'below' | 'within';
	type SortKey = 'deviation' | 'symbol' | 'price' | 'days';

	const PERIOD_PRESETS = [20, 50, 90, 200];

	let period = $state(90);
	let selectedDate = $state('');
	let rawData = $state<{
		symbols: string[];
		prices: Record<string, PriceRecord[]>;
		last_updated: string;
	} | null>(null);
	let results = $state<WMAResult[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let excluded = $state(0);
	let filter: Filter = $state('above');
	let search = $state('');
	let sortBy = $state<SortKey>('deviation');
	let theme = $state<'light' | 'dark'>(
		typeof window !== 'undefined' &&
			(document.documentElement.getAttribute('data-theme') === 'dark' ||
				localStorage.getItem('theme') === 'dark')
			? 'dark'
			: 'light'
	);

	function applyTheme(value: 'light' | 'dark') {
		document.documentElement.setAttribute('data-theme', value);
		try {
			localStorage.setItem('theme', value);
		} catch (error) {
			console.warn('Could not save theme preference:', error);
		}
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		applyTheme(theme);
	}

	const lastUpdated = $derived(rawData?.last_updated ?? '');

	$effect(() => {
		period;
		selectedDate;
		if (!rawData) return;
		const data = rawData;

		const analyzed: WMAResult[] = [];
		let skipped = 0;
		for (const symbol of data.symbols) {
			let prices = data.prices[symbol];
			if (selectedDate) prices = prices.filter((p) => p.date <= selectedDate);
			const r = analyzeStock(symbol, prices, period);
			if (r) analyzed.push(r);
			else skipped++;
		}
		analyzed.sort((a, b) => b.deviation - a.deviation);
		results = analyzed;
		excluded = skipped;
		loading = false;
	});

	const counts = $derived.by(() => {
		const c = { above: 0, below: 0, within: 0 };
		for (const r of results) c[r.status]++;
		return c;
	});

	const visible = $derived.by(() => {
		let list = results;
		if (filter !== 'all') list = list.filter((r) => r.status === filter);
		const q = search.trim().toUpperCase();
		if (q) list = list.filter((r) => r.symbol.includes(q));
		const sorted = [...list];
		switch (sortBy) {
			case 'symbol':
				sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
				break;
			case 'price':
				sorted.sort((a, b) => b.current_price - a.current_price);
				break;
			case 'days':
				sorted.sort((a, b) => b.days_in_status - a.days_in_status);
				break;
			default:
				sorted.sort((a, b) => b.deviation - a.deviation);
		}
		return sorted;
	});

	onMount(async () => {
		try {
			const response = await fetch('/data.json');
			if (!response.ok) throw new Error('data.json not found');
			rawData = await response.json();
		} catch (error) {
			loading = false;
			loadError = 'Failed to load market data. Make sure frontend/static/data.json exists.';
			console.error(error);
		}
	});

	function formatPrice(value: number): string {
		return '₨' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
	}
</script>

<div class="app">
	<header class="main-header">
		<div class="brand">
			<h1>📈 NEPSE Scanner</h1>
			{#if lastUpdated}
				<span class="updated">Updated {lastUpdated}</span>
			{/if}
		</div>
		<div class="header-actions">
			<input type="date" class="date-picker" bind:value={selectedDate} aria-label="As of date" />
			<button
				class="icon-btn"
				onclick={toggleTheme}
				aria-label="Toggle light or dark mode"
				title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				{theme === 'dark' ? '☀️' : '🌙'}
			</button>
		</div>
	</header>

	<div class="toolbar">
		<div class="period-control">
			<span class="period-label">WMA</span>
			<button class="step-btn" aria-label="Decrease period" onclick={() => (period = Math.max(5, period - 1))}>
				−
			</button>
			<span class="period-value">{period}d</span>
			<button class="step-btn" aria-label="Increase period" onclick={() => (period = Math.min(250, period + 1))}>
				+
			</button>
		</div>
		<div class="presets">
			{#each PERIOD_PRESETS as preset (preset)}
				<button
					class="preset"
					class:active={period === preset}
					onclick={() => (period = preset)}
				>
					{preset}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="loading">
			<div class="spinner" aria-hidden="true"></div>
			<span>Analyzing {period}-day WMA band…</span>
		</div>
	{:else if loadError}
		<div class="error">{loadError}</div>
	{:else}
		<div class="stats-tabs" role="tablist">
			<button
				class="tab above"
				class:active={filter === 'above'}
				role="tab"
				aria-selected={filter === 'above'}
				onclick={() => (filter = 'above')}
			>
				<span class="dot above"></span>Above <b>{counts.above}</b>
			</button>
			<button
				class="tab within"
				class:active={filter === 'within'}
				role="tab"
				aria-selected={filter === 'within'}
				onclick={() => (filter = 'within')}
			>
				<span class="dot within"></span>Within <b>{counts.within}</b>
			</button>
			<button
				class="tab below"
				class:active={filter === 'below'}
				role="tab"
				aria-selected={filter === 'below'}
				onclick={() => (filter = 'below')}
			>
				<span class="dot below"></span>Below <b>{counts.below}</b>
			</button>
			<button
				class="tab all"
				class:active={filter === 'all'}
				role="tab"
				aria-selected={filter === 'all'}
				onclick={() => (filter = 'all')}
			>
				All <b>{results.length}</b>
			</button>
		</div>

		<div class="controls">
			<input
				class="search"
				type="search"
				placeholder="🔍 Search symbol…"
				autocomplete="off"
				spellcheck="false"
				bind:value={search}
			/>
			<select class="sort" bind:value={sortBy} aria-label="Sort stocks">
				<option value="deviation">Sort: Deviation</option>
				<option value="symbol">Sort: Symbol</option>
				<option value="price">Sort: Price</option>
				<option value="days">Sort: Trend days</option>
			</select>
		</div>

		<p class="result-meta">
			Showing <b>{visible.length}</b> of <b>{results.length}</b> stocks
			{#if excluded > 0}
				<span class="muted"> · {excluded} skipped (less than {period} days of history)</span>
			{/if}
		</p>

		<div class="stock-list">
			{#each visible as stock (stock.symbol)}
				<div class="stock-card {stock.status}">
					<div class="card-top">
						<div class="symbol-block">
							<span class="symbol">{stock.symbol}</span>
							<span class="card-date">{stock.last_updated}</span>
						</div>
						<span class="status-badge {stock.status}">
							{stock.status === 'above'
								? '▲ ABOVE'
								: stock.status === 'below'
									? '▼ BELOW'
									: '◆ WITHIN'}
						</span>
					</div>

					<div class="card-mid">
						<div class="price">{formatPrice(stock.current_price)}</div>
						<div class="deviation {stock.deviation >= 0 ? 'positive' : 'negative'}">
							{stock.deviation >= 0 ? '+' : ''}{stock.deviation.toFixed(2)}%
						</div>
						<div class="days">{stock.days_in_status}d in trend</div>
					</div>

					<div class="band-row">
						<span class="band-label">{period}d band</span>
						<span class="band-value">{formatPrice(stock.wma_low)}</span>
						<div class="band-bar">
							<span class="band-fill" style="left: {stock.range_position}%"></span>
						</div>
						<span class="band-value">{formatPrice(stock.wma_high)}</span>
					</div>
				</div>
			{/each}
		</div>

		{#if visible.length === 0}
			<div class="empty">
				<div class="empty-icon">🔍</div>
				<p>No stocks match your search or filter.</p>
			</div>
		{/if}
	{/if}

	<footer class="main-footer">
		<span>WMA {period} · Updated {lastUpdated}</span>
	</footer>
</div>

<style>
	:global(:root) {
		color-scheme: light;
		--bg: #f8fafc;
		--surface: #ffffff;
		--surface-2: #f1f5f9;
		--border: #e2e8f0;
		--border-hover: #cbd5e1;
		--text: #1e293b;
		--text-strong: #0f172a;
		--text-secondary: #475569;
		--text-muted: #64748b;
		--text-faint: #94a3b8;
		--text-barely: #cbd5e1;
		--up-bg: #e8f5e9;
		--up-color: #2e7d32;
		--down-bg: #ffebee;
		--down-color: #c62828;
		--within-bg: #fff3e0;
		--within-color: #ef6c00;
		--tooltip-bg: #1e293b;
	}

	:global([data-theme='dark']) {
		color-scheme: dark;
		--bg: #0f172a;
		--surface: #1e293b;
		--surface-2: #334155;
		--border: #334155;
		--border-hover: #475569;
		--text: #e2e8f0;
		--text-strong: #f1f5f9;
		--text-secondary: #cbd5e1;
		--text-muted: #94a3b8;
		--text-faint: #64748b;
		--text-barely: #475569;
		--up-bg: rgba(46, 125, 50, 0.25);
		--up-color: #81c784;
		--down-bg: rgba(198, 40, 40, 0.25);
		--down-color: #ef9a9a;
		--within-bg: rgba(239, 108, 0, 0.25);
		--within-color: #ffb74d;
		--tooltip-bg: #334155;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: var(--bg);
		color: var(--text);
		-webkit-tap-highlight-color: transparent;
	}

	.app {
		max-width: 680px;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.main-header {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 16px 16px 12px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.brand {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	h1 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.updated {
		font-size: 12px;
		color: var(--text-faint);
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon-btn {
		background: var(--surface-2);
		border: 1px solid var(--border);
		padding: 10px 12px;
		border-radius: 10px;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
		color: var(--text-muted);
		min-height: 44px;
		min-width: 44px;
	}

	.icon-btn:hover {
		background: var(--border-soft, var(--surface));
		border-color: var(--border-hover);
	}

	.date-picker {
		padding: 9px 10px;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 13px;
		color: var(--text-secondary);
		background: var(--surface);
		min-height: 44px;
		max-width: 150px;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.period-control {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--surface-2);
		padding: 4px;
		border-radius: 10px;
		flex-shrink: 0;
	}

	.period-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-faint);
		padding: 0 6px;
		letter-spacing: 0.04em;
	}

	.step-btn {
		width: 36px;
		height: 36px;
		border: none;
		background: var(--surface);
		color: var(--text-muted);
		border-radius: 8px;
		cursor: pointer;
		font-weight: 700;
		font-size: 16px;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
	}

	.step-btn:hover {
		background: var(--border-hover);
	}

	.period-value {
		padding: 0 8px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text-strong);
		min-width: 34px;
		text-align: center;
	}

	.presets {
		display: flex;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.preset {
		flex: 1;
		background: var(--surface-2);
		border: 1px solid transparent;
		padding: 8px 4px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		min-height: 40px;
	}

	.preset.active {
		background: var(--text-strong);
		color: var(--surface);
		border-color: var(--text-strong);
	}

	.stats-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		padding: 14px 16px 0;
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 10px 4px;
		cursor: pointer;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		min-height: 56px;
	}

	.tab b {
		font-size: 16px;
		color: var(--text-strong);
	}

	.tab.active {
		border-color: var(--text-strong);
		box-shadow: 0 0 0 1px var(--text-strong);
	}

	.tab.active.above {
		border-color: var(--up-color);
		box-shadow: 0 0 0 1px var(--up-color);
	}

	.tab.active.within {
		border-color: var(--within-color);
		box-shadow: 0 0 0 1px var(--within-color);
	}

	.tab.active.below {
		border-color: var(--down-color);
		box-shadow: 0 0 0 1px var(--down-color);
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot.above {
		background: var(--up-color);
	}

	.dot.within {
		background: var(--within-color);
	}

	.dot.below {
		background: var(--down-color);
	}

	.controls {
		display: flex;
		gap: 8px;
		padding: 14px 16px 8px;
	}

	.search {
		flex: 1;
		min-width: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 11px 12px;
		font-size: 14px;
		color: var(--text);
		min-height: 44px;
	}

	.search:focus {
		outline: 2px solid var(--text-faint);
		outline-offset: 1px;
	}

	.sort {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 11px 8px;
		font-size: 13px;
		color: var(--text-secondary);
		min-height: 44px;
		max-width: 150px;
	}

	.result-meta {
		margin: 0;
		padding: 4px 16px 12px;
		font-size: 12px;
		color: var(--text-muted);
	}

	.result-meta .muted {
		color: var(--text-faint);
	}

	.stock-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 0 16px 24px;
	}

	.stock-card {
		background: var(--surface);
		border-radius: 14px;
		padding: 14px;
		border: 1px solid var(--border);
	}

	.stock-card.above {
		border-left: 4px solid var(--up-color);
	}

	.stock-card.below {
		border-left: 4px solid var(--down-color);
	}

	.stock-card.within {
		border-left: 4px solid var(--within-color);
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}

	.symbol-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.symbol {
		font-size: 17px;
		font-weight: 800;
		color: var(--text-strong);
		letter-spacing: 0.02em;
	}

	.card-date {
		font-size: 11px;
		color: var(--text-faint);
	}

	.status-badge {
		padding: 5px 10px;
		border-radius: 8px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}

	.status-badge.above {
		background: var(--up-bg);
		color: var(--up-color);
	}

	.status-badge.below {
		background: var(--down-bg);
		color: var(--down-color);
	}

	.status-badge.within {
		background: var(--within-bg);
		color: var(--within-color);
	}

	.card-mid {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 10px;
	}

	.price {
		font-size: 22px;
		font-weight: 800;
		color: var(--text-strong);
	}

	.deviation {
		font-size: 14px;
		font-weight: 700;
	}

	.deviation.positive {
		color: var(--up-color);
	}

	.deviation.negative {
		color: var(--down-color);
	}

	.days {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 600;
		white-space: nowrap;
	}

	.band-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}

	.band-label {
		font-size: 10px;
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--text-faint);
		white-space: nowrap;
	}

	.band-value {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.band-bar {
		flex: 1;
		height: 8px;
		background: linear-gradient(90deg, var(--down-color) 0%, var(--surface-2) 30%, var(--surface-2) 70%, var(--up-color) 100%);
		opacity: 0.35;
		border-radius: 4px;
		position: relative;
	}

	.band-fill {
		position: absolute;
		top: -3px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--text-strong);
		border: 2px solid var(--surface);
		transform: translateX(-50%);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
	}

	.stock-card.above .band-fill {
		background: var(--up-color);
	}

	.stock-card.below .band-fill {
		background: var(--down-color);
	}

	.stock-card.within .band-fill {
		background: var(--within-color);
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 72px 20px;
		color: var(--text-muted);
		font-size: 14px;
	}

	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid var(--border);
		border-top-color: var(--text-strong);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		padding: 48px 20px;
		text-align: center;
		color: var(--down-color);
		font-weight: 600;
	}

	.empty {
		padding: 48px 20px;
		text-align: center;
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 40px;
		margin-bottom: 8px;
	}

	.main-footer {
		padding: 20px 16px;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: center;
		font-size: 12px;
		color: var(--text-faint);
	}

	@media (min-width: 700px) {
		.app {
			max-width: 820px;
		}

		.stock-list {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
	}
</style>