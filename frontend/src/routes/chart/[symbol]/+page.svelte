<script lang="ts">
	import { onMount } from 'svelte';
	import { env as publicEnv } from '$env/dynamic/public';
	import { goto } from '$app/navigation';
	import CandleChart from '$lib/components/CandleChart.svelte';
	import type { PriceRecord } from '$lib/utils/wma';

	let { data } = $props();

	let prices = $state<PriceRecord[]>([]);
	let loading = $state(true);
	let notFound = $state(false);

	let theme = $state<'light' | 'dark'>(
		typeof window !== 'undefined' &&
			(document.documentElement.getAttribute('data-theme') === 'dark' ||
				localStorage.getItem('theme') === 'dark')
			? 'dark'
			: 'light'
	);

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', theme);
		try { localStorage.setItem('theme', theme); } catch {}
	}

	function formatPrice(v: number) {
		return '₨' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
	}

	onMount(async () => {
		try {
			const resp = await fetch('/data.json');
			if (!resp.ok) throw new Error('data.json not found');
			const raw = await resp.json();
			const all: PriceRecord[] = raw.prices[data.symbol] ?? [];
			if (all.length === 0) {
				notFound = true;
			} else {
				prices = [...all].sort(
					(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
				);
			}
		} catch {
			notFound = true;
		} finally {
			loading = false;
		}
	});

	const latest = $derived(prices.length > 0 ? prices[prices.length - 1] : null);
	const first = $derived(prices.length > 0 ? prices[0] : null);
	const high52w = $derived(prices.length > 0 ? Math.max(...prices.map(p => p.high)) : 0);
	const low52w = $derived(prices.length > 0 ? Math.min(...prices.map(p => p.low)) : 0);
	const change = $derived(latest && first ? ((latest.close - first.open) / first.open) * 100 : 0);
</script>

<svelte:head>
	<title>{data.symbol} Chart — NEPSE Scanner</title>
</svelte:head>

<div class="fullscreen">
	<header class="fs-header">
		<div class="fs-left">
			<button class="back-btn" onclick={() => goto('/')} aria-label="Back to scanner">
				← Back
			</button>
			<span class="fs-symbol">{data.symbol}</span>
			{#if latest}
				<span class="fs-price">{formatPrice(latest.close)}</span>
				<span class="fs-change {change >= 0 ? 'positive' : 'negative'}">
					{change >= 0 ? '+' : ''}{change.toFixed(2)}%
				</span>
			{/if}
		</div>
		<div class="fs-right">
			<span class="fs-range">
				{#if first && latest}
					{first.date} → {latest.date}
				{/if}
			</span>
			<button class="icon-btn-sm" onclick={toggleTheme} aria-label="Toggle theme">
				{theme === 'dark' ? '☀️' : '🌙'}
			</button>
		</div>
	</header>

	{#if loading}
		<div class="loading">
			<div class="spinner" aria-hidden="true"></div>
			<span>Loading {data.symbol}…</span>
		</div>
	{:else if notFound}
		<div class="empty-state">
			<p>No data found for <strong>{data.symbol}</strong>.</p>
			<button class="link-btn" onclick={() => goto('/')}>← Back to Scanner</button>
		</div>
	{:else}
		<div class="chart-grid">
			<div class="chart-main">
				<CandleChart
					symbol={data.symbol}
					{prices}
					{theme}
					height={Math.max(380, window.innerHeight - 160)}
				/>
			</div>

			{#if latest}
				<div class="detail-strip">
					<div class="strip-item">
						<span class="strip-label">Open</span>
						<span class="strip-val">{formatPrice(latest.open)}</span>
					</div>
					<div class="strip-item">
						<span class="strip-label">High</span>
						<span class="strip-val">{formatPrice(latest.high)}</span>
					</div>
					<div class="strip-item">
						<span class="strip-label">Low</span>
						<span class="strip-val">{formatPrice(latest.low)}</span>
					</div>
					<div class="strip-item">
						<span class="strip-label">Close</span>
						<span class="strip-val">{formatPrice(latest.close)}</span>
					</div>
					<div class="strip-item">
						<span class="strip-label">Vol</span>
						<span class="strip-val">{latest.volume.toLocaleString('en-IN')}</span>
					</div>
					<div class="strip-item">
						<span class="strip-label">52W H</span>
						<span class="strip-val high">{formatPrice(high52w)}</span>
					</div>
					<div class="strip-item">
						<span class="strip-label">52W L</span>
						<span class="strip-val low">{formatPrice(low52w)}</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.fullscreen {
		max-width: 1200px;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
	}

	.fs-header {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.fs-left, .fs-right {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.back-btn {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		min-height: 40px;
		white-space: nowrap;
	}
	.back-btn:hover { border-color: var(--border-hover); }

	.fs-symbol {
		font-size: 18px;
		font-weight: 800;
		color: var(--text-strong);
		letter-spacing: 0.02em;
	}

	.fs-price {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-strong);
	}

	.fs-change {
		font-size: 13px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 6px;
	}
	.fs-change.positive { background: var(--up-bg); color: var(--up-color); }
	.fs-change.negative { background: var(--down-bg); color: var(--down-color); }

	.fs-range {
		font-size: 11px;
		color: var(--text-faint);
		white-space: nowrap;
	}

	.icon-btn-sm {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 10px;
		font-size: 16px;
		cursor: pointer;
		min-height: 40px;
		min-width: 40px;
	}
	.icon-btn-sm:hover { border-color: var(--border-hover); }

	.chart-grid {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 16px;
		gap: 14px;
	}

	.chart-main {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.detail-strip {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.strip-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 14px;
		flex: 1;
		min-width: 80px;
	}

	.strip-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-faint);
	}

	.strip-val {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-strong);
	}
	.strip-val.high { color: var(--up-color); }
	.strip-val.low  { color: var(--down-color); }

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 120px 20px;
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

	@keyframes spin { to { transform: rotate(360deg); } }

	.empty-state {
		padding: 120px 20px;
		text-align: center;
		color: var(--text-muted);
	}

	.link-btn {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px 20px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		margin-top: 16px;
	}
	.link-btn:hover { border-color: var(--border-hover); }

	@media (min-width: 700px) {
		.detail-strip {
			flex-wrap: nowrap;
		}
		.strip-item {
			min-width: 90px;
		}
	}
</style>
