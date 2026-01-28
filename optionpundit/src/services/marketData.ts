/**
 * Market Data Service
 *
 * Client-side service for fetching market data from Vercel serverless functions.
 * Includes caching to minimize API calls.
 *
 * Uses:
 * - /api/optionpundit/quote - Stock quotes (Yahoo Finance)
 * - /api/optionpundit/options-chain - Options chain data
 * - /api/optionpundit/earnings - Earnings dates
 * - /api/optionpundit/dividends - Dividend information
 */

import type {
  MarketQuote,
  OptionsChainData,
  EarningsData,
  DividendData,
} from '../types';

// Cache TTLs (milliseconds)
const QUOTE_CACHE_TTL = 60 * 1000; // 1 minute
const EARNINGS_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const DIVIDEND_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// API base URL (empty for same-origin, or set for deployed API)
const API_BASE_URL = '';

// Cache storage
const quoteCache = new Map<string, { data: MarketQuote; expires: number }>();
const earningsCache = new Map<string, { data: EarningsData; expires: number }>();
const dividendCache = new Map<string, { data: DividendData; expires: number }>();

/**
 * Fetch stock quotes for multiple symbols
 */
export async function fetchQuotes(
  symbols: string[]
): Promise<Map<string, MarketQuote>> {
  const now = Date.now();
  const result = new Map<string, MarketQuote>();
  const symbolsToFetch: string[] = [];

  // Check cache
  for (const symbol of symbols) {
    const cached = quoteCache.get(symbol);
    if (cached && cached.expires > now) {
      result.set(symbol, cached.data);
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // Fetch missing symbols
  if (symbolsToFetch.length > 0) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/optionpundit/quote?symbols=${symbolsToFetch.join(',')}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const quotes = data.quotes as Record<string, MarketQuote>;

      // Update cache and result
      for (const [symbol, quote] of Object.entries(quotes)) {
        if (quote.currentPrice > 0) {
          quoteCache.set(symbol, {
            data: quote,
            expires: now + QUOTE_CACHE_TTL,
          });
          result.set(symbol, quote);
        }
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      // Continue with cached/empty data
    }
  }

  return result;
}

/**
 * Fetch single stock quote
 */
export async function fetchQuote(symbol: string): Promise<MarketQuote | null> {
  const quotes = await fetchQuotes([symbol]);
  return quotes.get(symbol) || null;
}

/**
 * Fetch options chain for a symbol
 */
export async function fetchOptionsChain(
  symbol: string,
  expiration?: string
): Promise<OptionsChainData | null> {
  try {
    let url = `${API_BASE_URL}/api/optionpundit/options-chain?symbol=${symbol}`;
    if (expiration) {
      url += `&expiration=${expiration}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching options chain:', error);
    return null;
  }
}

/**
 * Fetch earnings date for a symbol
 */
export async function fetchEarnings(symbol: string): Promise<EarningsData | null> {
  const now = Date.now();

  // Check cache
  const cached = earningsCache.get(symbol);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/optionpundit/earnings?symbol=${symbol}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: EarningsData = await response.json();

    // Update cache
    earningsCache.set(symbol, {
      data,
      expires: now + EARNINGS_CACHE_TTL,
    });

    return data;
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return null;
  }
}

/**
 * Fetch dividend info for a symbol
 */
export async function fetchDividends(
  symbol: string
): Promise<DividendData | null> {
  const now = Date.now();

  // Check cache
  const cached = dividendCache.get(symbol);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/optionpundit/dividends?symbol=${symbol}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: DividendData = await response.json();

    // Update cache
    dividendCache.set(symbol, {
      data,
      expires: now + DIVIDEND_CACHE_TTL,
    });

    return data;
  } catch (error) {
    console.error('Error fetching dividends:', error);
    return null;
  }
}

/**
 * Batch fetch all market data for multiple symbols
 */
export async function fetchMarketData(symbols: string[]): Promise<{
  quotes: Map<string, MarketQuote>;
  earnings: Map<string, EarningsData>;
  dividends: Map<string, DividendData>;
}> {
  // Fetch quotes first (most important)
  const quotes = await fetchQuotes(symbols);

  // Fetch earnings and dividends in parallel
  const [earningsResults, dividendResults] = await Promise.all([
    Promise.all(
      symbols.map(async (symbol) => {
        const data = await fetchEarnings(symbol);
        return { symbol, data };
      })
    ),
    Promise.all(
      symbols.map(async (symbol) => {
        const data = await fetchDividends(symbol);
        return { symbol, data };
      })
    ),
  ]);

  // Build maps
  const earnings = new Map<string, EarningsData>();
  for (const { symbol, data } of earningsResults) {
    if (data) earnings.set(symbol, data);
  }

  const dividends = new Map<string, DividendData>();
  for (const { symbol, data } of dividendResults) {
    if (data) dividends.set(symbol, data);
  }

  return { quotes, earnings, dividends };
}

/**
 * Clear all caches (useful for testing)
 */
export function clearMarketDataCache(): void {
  quoteCache.clear();
  earningsCache.clear();
  dividendCache.clear();
}

/**
 * Check if market is currently open
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Market closed on weekends
  if (day === 0 || day === 6) return false;

  // Convert to Eastern Time (approximate)
  // Market is open 9:30 AM - 4:00 PM ET
  // This is a simplified check - doesn't account for DST or holidays
  const etHours = hours; // Assuming local time is ET
  const etMinutes = minutes;

  if (etHours < 9 || (etHours === 9 && etMinutes < 30)) return false;
  if (etHours >= 16) return false;

  return true;
}

/**
 * Estimate when data was last updated
 */
export function getQuoteFreshness(symbol: string): 'live' | 'cached' | 'stale' | 'unknown' {
  const cached = quoteCache.get(symbol);
  if (!cached) return 'unknown';

  const now = Date.now();
  const age = now - (cached.expires - QUOTE_CACHE_TTL);

  if (age < 10000) return 'live'; // < 10 seconds
  if (age < 60000) return 'cached'; // < 1 minute
  return 'stale';
}



