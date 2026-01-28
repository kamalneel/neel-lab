/**
 * Vercel Serverless Function: Earnings Date
 *
 * Fetches next earnings date from Yahoo Finance.
 *
 * Usage: GET /api/earnings?symbol=AAPL
 *
 * Response:
 * {
 *   "symbol": "AAPL",
 *   "earningsDate": "2024-01-25",
 *   "daysUntilEarnings": 5
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Yahoo Finance quote API for earnings
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

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

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ error: 'Missing or invalid symbol parameter' });
    return;
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    const url = `${YAHOO_QUOTE_URL}?symbols=${upperSymbol}&fields=earningsTimestamp,earningsTimestampStart,earningsTimestampEnd`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OptionPundit/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.quoteResponse?.result?.[0];

    if (!result) {
      res.status(404).json({ error: `No data found for ${upperSymbol}` });
      return;
    }

    // Yahoo provides earnings timestamps
    const earningsTimestamp =
      result.earningsTimestamp ||
      result.earningsTimestampStart ||
      result.earningsTimestampEnd;

    let earningsDate: string | null = null;
    let daysUntilEarnings: number | null = null;

    if (earningsTimestamp) {
      const date = new Date(earningsTimestamp * 1000);
      earningsDate = date.toISOString().split('T')[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);

      daysUntilEarnings = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // If earnings date is in the past, set to null
      if (daysUntilEarnings < 0) {
        earningsDate = null;
        daysUntilEarnings = null;
      }
    }

    // Cache for 1 hour (earnings dates don't change often)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

    res.status(200).json({
      symbol: upperSymbol,
      earningsDate,
      daysUntilEarnings,
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({
      error: 'Failed to fetch earnings data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}



