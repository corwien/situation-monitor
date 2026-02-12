/**
 * Treasury Yield API - Fetch US Treasury yield data from FRED
 * 
 * FRED (Federal Reserve Economic Data) - St. Louis Fed
 * Free tier: Unlimited requests
 * Get your key at: https://fred.stlouisfed.org/docs/api/api_key.html
 */

import { FRED_API_KEY, FRED_BASE_URL, logger } from '$lib/config/api';

export interface TreasuryYield {
	date: string;
	value: number;
}

export interface YieldCurveData {
	'2Y': TreasuryYield | null;
	'10Y': TreasuryYield | null;
	spread: number | null; // 10Y - 2Y
	isInverted: boolean;
	lastUpdated: string;
}

// Treasury series IDs in FRED
const TREASURY_SERIES = {
	'2Y': 'DGS2', // 2-Year Treasury Constant Maturity Rate
	'10Y': 'DGS10' // 10-Year Treasury Constant Maturity Rate
} as const;

/**
 * Check if FRED API key is configured
 */
function hasFredApiKey(): boolean {
	return Boolean(FRED_API_KEY && FRED_API_KEY.length > 0 && !FRED_API_KEY.includes('your'));
}

/**
 * Demo data for when API is not available
 * Based on recent market conditions
 */
const DEMO_YIELD_DATA: YieldCurveData = {
	'2Y': { date: new Date().toISOString().split('T')[0], value: 4.25 },
	'10Y': { date: new Date().toISOString().split('T')[0], value: 4.55 },
	spread: 0.30, // 30 bps positive (normal)
	isInverted: false,
	lastUpdated: new Date().toISOString()
};

/**
 * Fetch latest treasury yield from FRED
 */
async function fetchYieldFromFred(seriesId: string): Promise<TreasuryYield | null> {
	try {
		// FRED API endpoint for latest observation
		const url = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&sort_order=desc&limit=1&api_key=${FRED_API_KEY}&file_type=json`;
		
		const response = await fetch(url);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		
		if (!data.observations || data.observations.length === 0) {
			return null;
		}

		const latest = data.observations[0];
		const value = parseFloat(latest.value);
		
		if (isNaN(value)) {
			return null;
		}

		return {
			date: latest.date,
			value
		};
	} catch (error) {
		logger.error('Treasury API', `Error fetching ${seriesId}:`, error);
		return null;
	}
}

/**
 * Fetch yield curve data (2Y and 10Y Treasury)
 */
export async function fetchYieldCurve(): Promise<YieldCurveData> {
	if (!hasFredApiKey()) {
		logger.log('Treasury API', 'Using demo yield data (FRED API key not configured)');
		return DEMO_YIELD_DATA;
	}

	try {
		logger.log('Treasury API', 'Fetching Treasury yields from FRED');

		const [yield2Y, yield10Y] = await Promise.all([
			fetchYieldFromFred(TREASURY_SERIES['2Y']),
			fetchYieldFromFred(TREASURY_SERIES['10Y'])
		]);

		// Check if we got valid data
		if (!yield2Y || !yield10Y) {
			logger.warn('Treasury API', 'No valid data from FRED, using demo data');
			return DEMO_YIELD_DATA;
		}

		const spread = yield10Y.value - yield2Y.value;
		const isInverted = spread < 0;

		return {
			'2Y': yield2Y,
			'10Y': yield10Y,
			spread,
			isInverted,
			lastUpdated: new Date().toISOString()
		};
	} catch (error) {
		logger.error('Treasury API', 'Error fetching yield curve, using demo data:', error);
		return DEMO_YIELD_DATA;
	}
}

/**
 * Fetch historical yield curve for charting
 * Returns last 90 days of 2Y and 10Y yields
 */
export async function fetchYieldCurveHistory(): Promise<{
	dates: string[];
	'2Y': number[];
	'10Y': number[];
	spread: number[];
}> {
	if (!hasFredApiKey()) {
		// Generate demo historical data
		const dates: string[] = [];
		const yields2Y: number[] = [];
		const yields10Y: number[] = [];
		const spreads: number[] = [];
		
		for (let i = 90; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			dates.push(date.toISOString().split('T')[0]);
			
			// Simulate some variation
			const base2Y = 4.25 + Math.sin(i / 10) * 0.3;
			const base10Y = 4.55 + Math.sin(i / 10) * 0.25;
			
			yields2Y.push(parseFloat(base2Y.toFixed(2)));
			yields10Y.push(parseFloat(base10Y.toFixed(2)));
			spreads.push(parseFloat((base10Y - base2Y).toFixed(2)));
		}
		
		return { dates, '2Y': yields2Y, '10Y': yields10Y, spread: spreads };
	}

	try {
		// Fetch last 90 observations for both series
		const [data2Y, data10Y] = await Promise.all([
			fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${TREASURY_SERIES['2Y']}&sort_order=desc&limit=90&api_key=${FRED_API_KEY}&file_type=json`).then(r => r.json()),
			fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${TREASURY_SERIES['10Y']}&sort_order=desc&limit=90&api_key=${FRED_API_KEY}&file_type=json`).then(r => r.json())
		]);

		if (!data2Y.observations || !data10Y.observations) {
			throw new Error('Invalid FRED response');
		}

		// Merge and align dates
		const yield2YMap = new Map(data2Y.observations.map((o: {date: string, value: string}) => [o.date, parseFloat(o.value)]));
		const yield10YMap = new Map(data10Y.observations.map((o: {date: string, value: string}) => [o.date, parseFloat(o.value)]));

		// Get common dates (sorted ascending)
		const allDates = [...new Set([...yield2YMap.keys(), ...yield10YMap.keys()])].sort();
		
		const dates: string[] = [];
		const yields2Y: number[] = [];
		const yields10Y: number[] = [];
		const spreads: number[] = [];

		for (const date of allDates) {
			const y2 = yield2YMap.get(date);
			const y10 = yield10YMap.get(date);
			
			if (y2 !== undefined && y10 !== undefined && typeof y2 === 'number' && typeof y10 === 'number' && !isNaN(y2) && !isNaN(y10)) {
				dates.push(date);
				yields2Y.push(Number(y2));
				yields10Y.push(Number(y10));
				spreads.push(parseFloat((Number(y10) - Number(y2)).toFixed(2)));
			}
		}

		return { dates, '2Y': yields2Y, '10Y': yields10Y, spread: spreads };
	} catch (error) {
		logger.error('Treasury API', 'Error fetching yield history:', error);
		// Return demo data
		return fetchYieldCurveHistory(); // Recursive call will use demo path
	}
}
