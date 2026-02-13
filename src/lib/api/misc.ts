/**
 * Miscellaneous API functions for specialized panels
 * Polymarket API: https://docs.polymarket.com/
 * Gamma API: https://gamma-api.polymarket.com (no auth required)
 */

import { LocalCache } from '$lib/utils/cache';

export interface Prediction {
	id: string;
	question: string;
	yes: number;
	no: number;
	volume: string;
	updated: string;
}

export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
}

export interface Contract {
	agency: string;
	description: string;
	vendor: string;
	amount: number;
}

export interface Layoff {
	company: string;
	count: number;
	title: string;
	date: string;
}

// Polymarket Gamma API endpoint
const POLYMARKET_API = 'https://gamma-api.polymarket.com';

/**
 * Fetch real Polymarket predictions using Gamma API
 * Docs: https://docs.polymarket.com/quickstart/fetching-data
 */
export async function fetchPolymarket(): Promise<Prediction[]> {
	const cacheKey = 'polymarket_predictions';
	const cacheTTLMinutes = 5; // 5 minutes - predictions update frequently

	// Check cache first
	const cached = LocalCache.get<Prediction[]>(cacheKey);
	if (cached) {
		return cached;
	}

	try {
		// Fetch active, non-closed events
		const url = `${POLYMARKET_API}/events?active=true&closed=false&limit=10`;
		
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Polymarket API error: ${response.status}`);
		}

		const events = await response.json();

		// Transform to Prediction format
		const predictions: Prediction[] = events.map((event: any) => {
			const market = event.markets?.[0];
			if (!market) return null;

			// Parse outcome prices (stored as JSON string)
			let yesPrice = 0.5;
			let noPrice = 0.5;
			
			try {
				if (market.outcomePrices) {
					const prices = JSON.parse(market.outcomePrices);
					if (prices.length >= 2) {
						yesPrice = parseFloat(prices[0]) || 0.5;
						noPrice = parseFloat(prices[1]) || 0.5;
					}
				}
			} catch (e) {
				// Use defaults if parsing fails
			}

			// Format volume
			const volume = formatVolume(event.volume);

			return {
				id: event.id,
				question: market.question || event.title,
				yes: Math.round(yesPrice * 100),
				no: Math.round(noPrice * 100),
				volume,
				updated: new Date(event.updatedAt || event.createdAt).toLocaleDateString()
			};
		}).filter(Boolean) as Prediction[];

		// Cache the result
		LocalCache.set(cacheKey, predictions, cacheTTLMinutes);

		return predictions;

	} catch (error) {
		console.error('Failed to fetch Polymarket data:', error);
		// Return empty array on error - UI will handle gracefully
		return [];
	}
}

/**
 * Format volume number to human readable string
 */
function formatVolume(volume: number): string {
	if (!volume) return '0';
	
	if (volume >= 1000000) {
		return `$${(volume / 1000000).toFixed(1)}M`;
	} else if (volume >= 1000) {
		return `$${(volume / 1000).toFixed(0)}K`;
	}
	return `$${volume.toFixed(0)}`;
}

/**
 * Fetch whale transactions
 * Note: Would use Whale Alert API - returning sample data
 */
export async function fetchWhaleTransactions(): Promise<WhaleTransaction[]> {
	// Sample whale transaction data
	return [
		{ coin: 'BTC', amount: 1500, usd: 150000000, hash: '0x1a2b...3c4d' },
		{ coin: 'ETH', amount: 25000, usd: 85000000, hash: '0x5e6f...7g8h' },
		{ coin: 'BTC', amount: 850, usd: 85000000, hash: '0x9i0j...1k2l' },
		{ coin: 'SOL', amount: 500000, usd: 75000000, hash: '0x3m4n...5o6p' },
		{ coin: 'ETH', amount: 15000, usd: 51000000, hash: '0x7q8r...9s0t' }
	];
}

/**
 * Fetch government contracts
 * Note: Would use USASpending.gov API - returning sample data
 */
export async function fetchGovContracts(): Promise<Contract[]> {
	// Sample government contract data
	return [
		{
			agency: 'DOD',
			description: 'Advanced radar systems development and integration',
			vendor: 'Raytheon',
			amount: 2500000000
		},
		{
			agency: 'NASA',
			description: 'Artemis program lunar lander support services',
			vendor: 'SpaceX',
			amount: 1800000000
		},
		{
			agency: 'DHS',
			description: 'Border security technology modernization',
			vendor: 'Palantir',
			amount: 450000000
		},
		{
			agency: 'VA',
			description: 'Electronic health records system upgrade',
			vendor: 'Oracle Cerner',
			amount: 320000000
		},
		{
			agency: 'DOE',
			description: 'Clean energy grid infrastructure',
			vendor: 'General Electric',
			amount: 275000000
		}
	];
}

/**
 * Fetch layoffs data
 * Note: Would use layoffs.fyi API or similar - returning sample data
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	const now = new Date();
	const formatDate = (daysAgo: number) => {
		const d = new Date(now);
		d.setDate(d.getDate() - daysAgo);
		return d.toISOString();
	};

	return [
		{ company: 'Meta', count: 1200, title: 'Restructuring engineering teams', date: formatDate(2) },
		{ company: 'Amazon', count: 850, title: 'AWS division optimization', date: formatDate(5) },
		{
			company: 'Salesforce',
			count: 700,
			title: 'Post-acquisition consolidation',
			date: formatDate(8)
		},
		{
			company: 'Intel',
			count: 1500,
			title: 'Manufacturing pivot restructure',
			date: formatDate(12)
		},
		{ company: 'Snap', count: 500, title: 'Cost reduction initiative', date: formatDate(15) }
	];
}
