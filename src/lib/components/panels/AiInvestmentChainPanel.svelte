<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { t } from '$lib/stores';

	let aiData = $state({
		nvidiaEarningsCountdown: 45,
		tsmcCapacity: 88,
		powerGrowth: 18,
		concentration: 42
	});
	let loading = $state(false);
	let error: string | null = $state(null);

	// Simulate data load
	// In real, fetch from APIs
</script>

<Panel id="aiinvestment" title={$t('panels.aiinvestment.name')} {loading} {error}>
	<div class="ai-container">
		<div class="item">
			<div class="label">NVIDIA Earnings Countdown</div>
			<div class="value">{aiData.nvidiaEarningsCountdown} days</div>
		</div>
		<div class="item">
			<div class="label">TSMC Capacity Utilization</div>
			<div class="value">{aiData.tsmcCapacity}%</div>
		</div>
		<div class="item">
			<div class="label">US Data Center Power Growth</div>
			<div class="value">+{aiData.powerGrowth}% YoY</div>
		</div>
		<div class="item">
			<div class="label">AI Stock Concentration</div>
			<div class="value">{aiData.concentration}% (Top 10)</div>
		</div>
	</div>
</Panel>

<style>
	.ai-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		padding: 1rem;
	}

	.item {
		text-align: center;
	}

	.label {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.value {
		font-size: 1.2rem;
		font-weight: bold;
	}
</style>
