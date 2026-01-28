/**
 * Vercel Serverless Function: Stock Quote
 *
 * Fetches real-time stock quotes from Yahoo Finance.
 *
 * Usage: GET /api/quote?symbols=AAPL,NVDA,MSFT
 *
 * Response:
 * {
 *   "quotes": {
 *     "AAPL": { "symbol": "AAPL", "currentPrice": 175.50, ... },
 *     "NVDA": { "symbol": "NVDA", "currentPrice": 450.00, ... }
 *   }
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Yahoo Finance quote API endpoint
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

interface YahooQuoteResult {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketVolume: number;
  bid: number;
  ask: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
}

interface QuoteResponse {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
  volume: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { symbols } = req.query;

  if (!symbols || typeof symbols !== 'string') {
    res.status(400).json({ error: 'Missing or invalid symbols parameter' });
    return;
  }

  const symbolList = symbols
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  if (symbolList.length === 0) {
    res.status(400).json({ error: 'No valid symbols provided' });
    return;
  }

  if (symbolList.length > 20) {
    res.status(400).json({ error: 'Maximum 20 symbols per request' });
    return;
  }

  try {
    const url = `${YAHOO_QUOTE_URL}?symbols=${symbolList.join(',')}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OptionPundit/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data?.quoteResponse?.result || [];

    const quotes: Record<string, QuoteResponse> = {};

    for (const result of results as YahooQuoteResult[]) {
      quotes[result.symbol] = {
        symbol: result.symbol,
        currentPrice: result.regularMarketPrice ?? 0,
        change: result.regularMarketChange ?? 0,
        changePercent: result.regularMarketChangePercent ?? 0,
        previousClose: result.regularMarketPreviousClose ?? 0,
        volume: result.regularMarketVolume ?? 0,
        bid: result.bid ?? 0,
        ask: result.ask ?? 0,
        high: result.regularMarketDayHigh ?? 0,
        low: result.regularMarketDayLow ?? 0,
      };
    }

    // Check for missing symbols
    for (const symbol of symbolList) {
      if (!quotes[symbol]) {
        quotes[symbol] = {
          symbol,
          currentPrice: 0,
          change: 0,
          changePercent: 0,
          previousClose: 0,
          volume: 0,
          bid: 0,
          ask: 0,
          high: 0,
          low: 0,
        };
      }
    }

    // Cache for 60 seconds
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    res.status(200).json({ quotes });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({
      error: 'Failed to fetch quotes',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}



