/**
 * News API - Fetch news from GDELT
 * Each category: max 10 latest articles
 * Shows: source, time, link
 */

import { FEEDS } from '$lib/config/feeds';
import type { NewsItem, NewsCategory } from '$lib/types';
import { fetchWithProxy, API_DELAYS, logger } from '$lib/config/api';

function hashCode(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGdeltDate(dateStr: string): Date {
	if (!dateStr) return new Date();
	const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
	if (match) {
		const [, year, month, day, hour, min, sec] = match;
		return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
	}
	return new Date(dateStr);
}

interface GdeltArticle {
	title: string;
	url: string;
	seendate: string;
	domain: string;
	socialimage?: string;
}

interface GdeltResponse {
	articles?: GdeltArticle[];
}

function transformArticle(
	article: GdeltArticle,
	category: NewsCategory,
	source: string,
	index: number
): NewsItem {
	const title = article.title || '';
	const urlHash = article.url ? hashCode(article.url) : Math.random().toString(36).slice(2);
	const uniqueId = `gdelt-${category}-${urlHash}-${index}`;
	const parsedDate = parseGdeltDate(article.seendate);

	return {
		id: uniqueId,
		title,
		link: article.url,
		pubDate: article.seendate,
		timestamp: parsedDate.getTime(),
		source: source || article.domain || 'Unknown',
		category,
		isAlert: false,
		region: undefined,
		topics: []
	};
}

// News categories to fetch
const NEWS_CATEGORIES: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

// Category queries for GDELT
const CATEGORY_QUERIES: Record<NewsCategory, string> = {
	politics: '(politics OR government OR election OR congress) sourcelang:english',
	tech: '(technology OR software OR "artificial intelligence") sourcelang:english',
	finance: '(finance OR "stock market" OR economy) sourcelang:english',
	gov: '("federal government" OR "white house") sourcelang:english',
	ai: '("artificial intelligence" OR AI OR "machine learning") sourcelang:english',
	intel: '(intelligence OR military OR defense) sourcelang:english'
};

/**
 * Fetch news for a category - max 10 articles
 */
export async function fetchCategoryNews(category: NewsCategory): Promise<NewsItem[]> {
	const maxArticles = 10;

	try {
		const query = CATEGORY_QUERIES[category];
		const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&timespan=3d&mode=artlist&maxrecords=${maxArticles}&format=json&sort=date`;

		logger.log('News', `Fetching ${category} (max ${maxArticles})`);

		const response = await fetchWithProxy(gdeltUrl);
		if (!response.ok) {
			logger.warn('News', `${category}: HTTP ${response.status}`);
			return [];
		}

		const contentType = response.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			logger.warn('News', `${category}: Non-JSON response`);
			return [];
		}

		const text = await response.text();
		let data: GdeltResponse;
		try {
			data = JSON.parse(text);
		} catch {
			logger.warn('News', `${category}: Invalid JSON`);
			return [];
		}

		if (!data?.articles) return [];

		// Get source name for this category
		const categoryFeeds = FEEDS[category] || [];
		const defaultSource = categoryFeeds[0]?.name || 'News';

		// Transform and return max 10
		return data.articles
			.slice(0, maxArticles)
			.map((article, index) => transformArticle(article, category, article.domain || defaultSource, index));
	} catch (error) {
		logger.error('News', `Error fetching ${category}:`, error);
		return [];
	}
}

/**
 * Fetch all news - sequential with delays
 */
export async function fetchAllNews(): Promise<Record<NewsCategory, NewsItem[]>> {
	const result: Record<NewsCategory, NewsItem[]> = {
		politics: [],
		tech: [],
		finance: [],
		gov: [],
		ai: [],
		intel: []
	};

	for (let i = 0; i < NEWS_CATEGORIES.length; i++) {
		const category = NEWS_CATEGORIES[i];

		if (i > 0) {
			await delay(API_DELAYS.betweenCategories);
		}

		result[category] = await fetchCategoryNews(category);
	}

	return result;
}
