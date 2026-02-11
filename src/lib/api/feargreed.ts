/**
 * Fear & Greed Index API - BTC market sentiment indicator
 * Data from alternative.me
 * https://alternative.me/crypto/fear-and-greed-index/
 */

import { logger } from '$lib/config/api';

export interface FearGreedData {
	value: number;
	value_classification: string;
	timestamp: string;
	time_until_update: string;
}

export interface FearGreedResponse {
	name: string;
	data: FearGreedData[];
}

export type FearGreedClassification = 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';

/**
 * Fetch Fear & Greed Index from alternative.me API
 */
export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
	try {
		const url = 'https://api.alternative.me/fng/?limit=1';
		logger.log('Fear & Greed API', 'Fetching from alternative.me');

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: FearGreedResponse = await response.json();

		if (!data.data || data.data.length === 0) {
			throw new Error('No data received from API');
		}

		return data.data[0];
	} catch (error) {
		logger.error('Fear & Greed API', 'Error fetching data:', error);
		return null;
	}
}

/**
 * Get classification text in Chinese/English based on value
 */
export function getFearGreedLabel(classification: string): string {
	const labels: Record<string, string> = {
		'Extreme Fear': '极度恐惧',
		'Fear': '恐惧',
		'Neutral': '中性',
		'Greed': '贪婪',
		'Extreme Greed': '极度贪婪'
	};
	return labels[classification] || classification;
}

/**
 * Get CSS class for the sentiment value
 */
export function getFearGreedClass(value: number | undefined): string {
	if (value === undefined) return '';
	if (value <= 20) return 'extreme-fear';
	if (value <= 40) return 'fear';
	if (value <= 60) return 'neutral';
	if (value <= 80) return 'greed';
	return 'extreme-greed';
}

/**
 * Get status text for panel header
 */
export function getFearGreedStatus(value: number | undefined): string {
	if (value === undefined) return '';
	if (value <= 20) return 'EXTREME FEAR';
	if (value <= 40) return 'FEAR';
	if (value <= 60) return 'NEUTRAL';
	if (value <= 80) return 'GREED';
	return 'EXTREME GREED';
}
