/**
 * Vercel Serverless Function: Options Chain
 *
 * Fetches options chain data from Yahoo Finance.
 *
 * Usage: GET /api/options-chain?symbol=AAPL&expiration=2024-01-19
 *
 * Response:
 * {
 *   "symbol": "AAPL",
 *   "underlyingPrice": 175.50,
 *   "expirationDate": "2024-01-19",
 *   "calls": [...],
 *   "puts": [...]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Yahoo Finance options API endpoint
const YAHOO_OPTIONS_URL = 'https://query1.finance.yahoo.com/v7/finance/options';

interface YahooOption {
  strike: number;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  expiration: number;
}

interface OptionQuote {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  expirationDate: string;
  midPrice: number;
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

  const { symbol, expiration } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ error: 'Missing or invalid symbol parameter' });
    return;
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    // Build URL - if expiration provided, convert to Unix timestamp
    let url = `${YAHOO_OPTIONS_URL}/${upperSymbol}`;

    if (expiration && typeof expiration === 'string') {
      // Convert YYYY-MM-DD to Unix timestamp
      const expDate = new Date(expiration);
      const timestamp = Math.floor(expDate.getTime() / 1000);
      url += `?date=${timestamp}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OptionPundit/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const optionChain = data?.optionChain?.result?.[0];

    if (!optionChain) {
      res.status(404).json({ error: `No options data found for ${upperSymbol}` });
      return;
    }

    const underlyingPrice = optionChain.quote?.regularMarketPrice ?? 0;
    const options = optionChain.options?.[0];

    if (!options) {
      res.status(404).json({ error: `No options available for ${upperSymbol}` });
      return;
    }

    // Parse calls
    const calls: OptionQuote[] = (options.calls || []).map((opt: YahooOption) => ({
      strike: opt.strike ?? 0,
      bid: opt.bid ?? 0,
      ask: opt.ask ?? 0,
      last: opt.lastPrice ?? 0,
      volume: opt.volume ?? 0,
      openInterest: opt.openInterest ?? 0,
      impliedVolatility: opt.impliedVolatility ?? 0,
      inTheMoney: opt.inTheMoney ?? false,
      expirationDate: new Date(opt.expiration * 1000).toISOString().split('T')[0],
      midPrice: opt.bid && opt.ask ? (opt.bid + opt.ask) / 2 : opt.lastPrice ?? 0,
    }));

    // Parse puts
    const puts: OptionQuote[] = (options.puts || []).map((opt: YahooOption) => ({
      strike: opt.strike ?? 0,
      bid: opt.bid ?? 0,
      ask: opt.ask ?? 0,
      last: opt.lastPrice ?? 0,
      volume: opt.volume ?? 0,
      openInterest: opt.openInterest ?? 0,
      impliedVolatility: opt.impliedVolatility ?? 0,
      inTheMoney: opt.inTheMoney ?? false,
      expirationDate: new Date(opt.expiration * 1000).toISOString().split('T')[0],
      midPrice: opt.bid && opt.ask ? (opt.bid + opt.ask) / 2 : opt.lastPrice ?? 0,
    }));

    // Get all available expirations
    const expirations: string[] = (optionChain.expirationDates || []).map(
      (ts: number) => new Date(ts * 1000).toISOString().split('T')[0]
    );

    // Cache for 60 seconds
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    res.status(200).json({
      symbol: upperSymbol,
      underlyingPrice,
      expirationDate: expiration || expirations[0],
      expirations,
      calls,
      puts,
    });
  } catch (error) {
    console.error('Error fetching options chain:', error);
    res.status(500).json({
      error: 'Failed to fetch options chain',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}



