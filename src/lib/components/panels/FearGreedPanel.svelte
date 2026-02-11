<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { fearGreed, fearGreedValue, fearGreedClassification, t, locale } from '$lib/stores';
	import { getFearGreedLabel, getFearGreedClass } from '$lib/api';

	const data = $derived($fearGreed.data);
	const loading = $derived($fearGreed.loading);
	const error = $derived($fearGreed.error);
	const value = $derived($fearGreedValue);
	const classification = $derived($fearGreedClassification);

	// Compute status text for panel header
	const status = $derived(value !== undefined ? `${value}/100` : '');

	// Get label based on current locale
	function getLocalizedLabel(classification: string): string {
		if (!classification) return '';
		// If Chinese locale, use the Chinese translation keys
		if ($locale === 'zh') {
			const key = `panels.feargreed.${classification.toLowerCase().replace(/\s+/g, '')}.zh`;
			return $t(key as import('$lib/i18n/translations').TranslationKey);
		}
		// For English, use the label from API or translation
		const label = getFearGreedLabel(classification);
		// If label is already Chinese (from API), return classification instead
		if (/[\u4e00-\u9fa5]/.test(label)) {
			return classification;
		}
		return label;
	}
	
	const label = $derived(classification ? getLocalizedLabel(classification) : '');
	const sentimentClass = $derived(getFearGreedClass(value));
</script>

<Panel id="feargreed" title={$t('panels.feargreed.name')} count={status} {loading} {error}>
	{#if !data && !loading && !error}
		<div class="empty-state">{$t('panel.empty')}</div>
	{:else if data}
		<div class="fear-greed-container">
			<div class="gauge-container">
				<div class="gauge">
					<div class="gauge-value {sentimentClass}">{value}</div>
					<div class="gauge-label">{$t('panels.feargreed.index')}</div>
				</div>
			</div>
			<div class="sentiment {sentimentClass}">
				{label}
			</div>
			<div class="classification">
				<span class="en">{classification}</span>
				{#if $locale === 'en' && classification}
					<span class="local">{getFearGreedLabel(classification)}</span>
				{/if}
			</div>
		</div>
	{/if}
</Panel>

<style>
	.fear-greed-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 0;
		gap: 0.75rem;
	}

	.gauge-container {
		position: relative;
	}

	.gauge {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: conic-gradient(
			from 180deg,
			var(--danger) 0deg 36deg,
			var(--warning) 36deg 72deg,
			var(--info) 72deg 108deg,
			var(--success) 108deg 144deg,
			var(--danger) 144deg 180deg
		);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.gauge::before {
		content: '';
		position: absolute;
		width: 60px;
		height: 60px;
		background: var(--bg-panel);
		border-radius: 50%;
	}

	.gauge-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		z-index: 1;
		font-variant-numeric: tabular-nums;
	}

	.gauge-value.extreme-fear {
		color: var(--danger);
	}

	.gauge-value.fear {
		color: #ff6b6b;
	}

	.gauge-value.neutral {
		color: var(--warning);
	}

	.gauge-value.greed {
		color: #51cf66;
	}

	.gauge-value.extreme-greed {
		color: var(--success);
	}

	.gauge-label {
		font-size: 0.5rem;
		color: var(--text-muted);
		z-index: 1;
		text-transform: uppercase;
		margin-top: -2px;
	}

	.sentiment {
		font-size: 1rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sentiment.extreme-fear {
		color: var(--danger);
	}

	.sentiment.fear {
		color: #ff6b6b;
	}

	.sentiment.neutral {
		color: var(--warning);
	}

	.sentiment.greed {
		color: #51cf66;
	}

	.sentiment.extreme-greed {
		color: var(--success);
	}

	.classification {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.65rem;
		color: var(--text-secondary);
	}

	.classification .en {
		opacity: 0.7;
	}

	.classification .local {
		font-weight: 500;
	}

	.empty-state {
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.7rem;
		padding: 1rem;
	}
</style>
