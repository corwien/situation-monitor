/**
 * Markets API - Fetch market data from Finnhub
 *
 * Get your free API key at: https://finnhub.io/
 * Free tier: 60 calls/minute
 */

import { INDICES, SECTORS, COMMODITIES, CRYPTO } from '$lib/config/markets';
import type { MarketItem, SectorPerformance, CryptoItem } from '$lib/types';
import { fetchWithProxy, logger, FINNHUB_API_KEY, FINNHUB_BASE_URL } from '$lib/config/api';

interface CoinGeckoPrice {
	usd: number;
	usd_24h_change?: number;
}

interface CoinGeckoPricesResponse {
	[key: string]: CoinGeckoPrice;
}

interface FinnhubQuote {
	c: number; // Current price
	d: number; // Change
	dp: number; // Percent change
	h: number; // High price of the day
	l: number; // Low price of the day
	o: number; // Open price of the day
	pc: number; // Previous close price
	t: number; // Timestamp
}

/**
 * Check if Finnhub API key is configured
 */
function hasFinnhubApiKey(): boolean {
	return Boolean(FINNHUB_API_KEY && FINNHUB_API_KEY.length > 0 && !FINNHUB_API_KEY.includes('your_api_key'));
}

/**
 * Demo/Mock data for when API is not available
 * Provides realistic market data for demonstration purposes
 */
const DEMO_DATA = {
	// Index ETFs approximations (based on typical values)
	indices: {
		'DIA': { c: 43850, d: 125.5, dp: 0.29 },    // Dow ~ DIA * 0.1
		'SPY': { c: 605.50, d: 1.25, dp: 0.21 },    // S&P 500
		'QQQ': { c: 528.75, d: 2.15, dp: 0.41 },    // NASDAQ-100
		'IWM': { c: 223.40, d: -0.85, dp: -0.38 }   // Russell 2000
	},
	// Sector ETFs
	sectors: {
		'XLK': { c: 247.50, d: 1.85, dp: 0.75 },    // Technology
		'XLF': { c: 50.25, d: 0.15, dp: 0.30 },     // Financials
		'XLE': { c: 96.80, d: -0.45, dp: -0.46 },   // Energy
		'XLI': { c: 138.20, d: 0.42, dp: 0.30 },    // Industrials
		'XLP': { c: 81.50, d: 0.08, dp: 0.10 },     // Consumer Staples
		'XLRE': { c: 43.85, d: -0.12, dp: -0.27 },  // Real Estate
		'XLU': { c: 77.40, d: 0.25, dp: 0.32 },     // Utilities
		'XLB': { c: 92.15, d: 0.35, dp: 0.38 },     // Materials
		'XLC': { c: 88.60, d: 0.55, dp: 0.62 },     // Communication
		'XLV': { c: 149.30, d: -0.25, dp: -0.17 }   // Health Care
	},
	// Commodity proxies
	commodities: {
		'VIXY': { c: 12.85, d: -0.35, dp: -2.65 },  // VIX proxy
		'GLD': { c: 268.50, d: 2.15, dp: 0.81 },    // Gold
		'USO': { c: 78.25, d: -0.45, dp: -0.57 },   // Oil
		'UNG': { c: 14.35, d: 0.08, dp: 0.56 },     // Natural Gas
		'SLV': { c: 29.80, d: 0.25, dp: 0.84 },     // Silver
		'CPER': { c: 28.45, d: 0.12, dp: 0.42 }     // Copper
	},
	// Crypto (approximate values)
	crypto: {
		'bitcoin': { usd: 98500, usd_24h_change: 2.35 },
		'ethereum': { usd: 3780, usd_24h_change: 1.85 },
		'solana': { usd: 218, usd_24h_change: 4.20 }
	}
};

// Map index symbols to ETF proxies (free tier doesn't support direct indices)
const INDEX_ETF_MAP: Record<string, string> = {
	'^DJI': 'DIA', // Dow Jones -> SPDR Dow Jones ETF
	'^GSPC': 'SPY', // S&P 500 -> SPDR S&P 500 ETF
	'^IXIC': 'QQQ', // NASDAQ -> Invesco QQQ (NASDAQ-100)
	'^RUT': 'IWM' // Russell 2000 -> iShares Russell 2000 ETF
};

/**
 * Fetch a quote from Finnhub
 */
async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
	try {
		const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: FinnhubQuote = await response.json();

		// Finnhub returns all zeros when symbol not found
		if (data.c === 0 && data.pc === 0) {
			return null;
		}

		return data;
	} catch (error) {
		logger.error('Markets API', `Error fetching quote for ${symbol}:`, error);
		return null;
	}
}

/**
 * Fetch crypto prices from CoinGecko via proxy
 * Falls back to demo data if API fails
 */
export async function fetchCryptoPrices(): Promise<CryptoItem[]> {
	const createDemoCrypto = () =>
		CRYPTO.map((c) => {
			const demo = DEMO_DATA.crypto[c.id as keyof typeof DEMO_DATA.crypto];
			return {
				id: c.id,
				symbol: c.symbol,
				name: c.name,
				current_price: demo?.usd ?? 0,
				price_change_24h: demo?.usd_24h_change ?? 0,
				price_change_percentage_24h: demo?.usd_24h_change ?? 0
			};
		});

	try {
		const ids = CRYPTO.map((c) => c.id).join(',');
		const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

		logger.log('Markets API', 'Fetching crypto from CoinGecko');

		const response = await fetchWithProxy(coinGeckoUrl);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: CoinGeckoPricesResponse = await response.json();

		// Check if we got valid data
		const hasValidData = Object.values(data).some((priceData) => priceData?.usd > 0);
		if (!hasValidData) {
			logger.warn('Markets API', 'No valid crypto data from API, using demo data');
			return createDemoCrypto();
		}

		return CRYPTO.map((crypto) => {
			const priceData = data[crypto.id];
			return {
				id: crypto.id,
				symbol: crypto.symbol,
				name: crypto.name,
				current_price: priceData?.usd || 0,
				price_change_24h: priceData?.usd_24h_change || 0,
				price_change_percentage_24h: priceData?.usd_24h_change || 0
			};
		});
	} catch (error) {
		logger.error('Markets API', 'Error fetching crypto, using demo data:', error);
		return createDemoCrypto();
	}
}

/**
 * Fetch market indices from Finnhub
 * Falls back to demo data if API key is not available
 */
export async function fetchIndices(): Promise<MarketItem[]> {
	const createDemoIndices = () =>
		INDICES.map((i) => {
			const etfSymbol = INDEX_ETF_MAP[i.symbol] || i.symbol;
			const demo = DEMO_DATA.indices[etfSymbol as keyof typeof DEMO_DATA.indices];
			return {
				symbol: i.symbol,
				name: i.name,
				price: demo?.c ?? NaN,
				change: demo?.d ?? NaN,
				changePercent: demo?.dp ?? NaN,
				type: 'index' as const
			};
		});

	if (!hasFinnhubApiKey()) {
		logger.log('Markets API', 'Using demo data for indices (API key not configured)');
		return createDemoIndices();
	}

	try {
		logger.log('Markets API', 'Fetching indices from Finnhub');

		const quotes = await Promise.all(
			INDICES.map(async (index) => {
				const etfSymbol = INDEX_ETF_MAP[index.symbol] || index.symbol;
				const quote = await fetchFinnhubQuote(etfSymbol);
				return { index, quote };
			})
		);

		// Check if we got valid data, otherwise use demo
		const hasValidData = quotes.some(({ quote }) => quote && quote.c > 0);
		if (!hasValidData) {
			logger.warn('Markets API', 'No valid data from API, using demo data for indices');
			return createDemoIndices();
		}

		return quotes.map(({ index, quote }) => ({
			symbol: index.symbol,
			name: index.name,
			price: quote?.c ?? NaN,
			change: quote?.d ?? NaN,
			changePercent: quote?.dp ?? NaN,
			type: 'index' as const
		}));
	} catch (error) {
		logger.error('Markets API', 'Error fetching indices, using demo data:', error);
		return createDemoIndices();
	}
}

/**
 * Fetch sector performance from Finnhub (using sector ETFs)
 * Falls back to demo data if API key is not available
 */
export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
	const createDemoSectors = () =>
		SECTORS.map((s) => {
			const demo = DEMO_DATA.sectors[s.symbol as keyof typeof DEMO_DATA.sectors];
			return {
				symbol: s.symbol,
				name: s.name,
				price: demo?.c ?? NaN,
				change: demo?.d ?? NaN,
				changePercent: demo?.dp ?? NaN
			};
		});

	if (!hasFinnhubApiKey()) {
		logger.log('Markets API', 'Using demo data for sectors (API key not configured)');
		return createDemoSectors();
	}

	try {
		logger.log('Markets API', 'Fetching sector performance from Finnhub');

		const quotes = await Promise.all(
			SECTORS.map(async (sector) => {
				const quote = await fetchFinnhubQuote(sector.symbol);
				return { sector, quote };
			})
		);

		// Check if we got valid data, otherwise use demo
		const hasValidData = quotes.some(({ quote }) => quote && quote.c > 0);
		if (!hasValidData) {
			logger.warn('Markets API', 'No valid data from API, using demo data for sectors');
			return createDemoSectors();
		}

		return quotes.map(({ sector, quote }) => ({
			symbol: sector.symbol,
			name: sector.name,
			price: quote?.c ?? NaN,
			change: quote?.d ?? NaN,
			changePercent: quote?.dp ?? NaN
		}));
	} catch (error) {
		logger.error('Markets API', 'Error fetching sectors, using demo data:', error);
		return createDemoSectors();
	}
}

// Finnhub commodity ETF proxies (free tier doesn't support direct commodities)
const COMMODITY_SYMBOL_MAP: Record<string, string> = {
	'^VIX': 'VIXY', // VIX -> ProShares VIX Short-Term Futures ETF
	'GC=F': 'GLD', // Gold -> SPDR Gold Shares
	'CL=F': 'USO', // Crude Oil -> United States Oil Fund
	'NG=F': 'UNG', // Natural Gas -> United States Natural Gas Fund
	'SI=F': 'SLV', // Silver -> iShares Silver Trust
	'HG=F': 'CPER' // Copper -> United States Copper Index Fund
};

/**
 * Fetch commodities from Finnhub
 * Falls back to demo data if API key is not available
 */
export async function fetchCommodities(): Promise<MarketItem[]> {
	const createDemoCommodities = () =>
		COMMODITIES.map((c) => {
			const finnhubSymbol = COMMODITY_SYMBOL_MAP[c.symbol] || c.symbol;
			const demo = DEMO_DATA.commodities[finnhubSymbol as keyof typeof DEMO_DATA.commodities];
			return {
				symbol: c.symbol,
				name: c.name,
				price: demo?.c ?? NaN,
				change: demo?.d ?? NaN,
				changePercent: demo?.dp ?? NaN,
				type: 'commodity' as const
			};
		});

	if (!hasFinnhubApiKey()) {
		logger.log('Markets API', 'Using demo data for commodities (API key not configured)');
		return createDemoCommodities();
	}

	try {
		logger.log('Markets API', 'Fetching commodities from Finnhub');

		const quotes = await Promise.all(
			COMMODITIES.map(async (commodity) => {
				const finnhubSymbol = COMMODITY_SYMBOL_MAP[commodity.symbol] || commodity.symbol;
				const quote = await fetchFinnhubQuote(finnhubSymbol);
				return { commodity, quote };
			})
		);

		// Check if we got valid data, otherwise use demo
		const hasValidData = quotes.some(({ quote }) => quote && quote.c > 0);
		if (!hasValidData) {
			logger.warn('Markets API', 'No valid data from API, using demo data for commodities');
			return createDemoCommodities();
		}

		return quotes.map(({ commodity, quote }) => ({
			symbol: commodity.symbol,
			name: commodity.name,
			price: quote?.c ?? NaN,
			change: quote?.d ?? NaN,
			changePercent: quote?.dp ?? NaN,
			type: 'commodity' as const
		}));
	} catch (error) {
		logger.error('Markets API', 'Error fetching commodities, using demo data:', error);
		return createDemoCommodities();
	}
}

interface AllMarketsData {
	crypto: CryptoItem[];
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
}

/**
 * Fetch all market data
 */
export async function fetchAllMarkets(): Promise<AllMarketsData> {
	const [crypto, indices, sectors, commodities] = await Promise.all([
		fetchCryptoPrices(),
		fetchIndices(),
		fetchSectorPerformance(),
		fetchCommodities()
	]);

	return { crypto, indices, sectors, commodities };
}
