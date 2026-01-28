/**
 * Vercel Serverless Function: Dividend Info
 *
 * Fetches dividend information from Yahoo Finance.
 *
 * Usage: GET /api/dividends?symbol=AAPL
 *
 * Response:
 * {
 *   "symbol": "AAPL",
 *   "exDividendDate": "2024-02-09",
 *   "dividendAmount": 0.24,
 *   "dividendYield": 0.55,
 *   "daysUntilExDiv": 12
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Yahoo Finance quote API for dividends
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
    const url = `${YAHOO_QUOTE_URL}?symbols=${upperSymbol}&fields=dividendDate,exDividendDate,dividendRate,dividendYield,trailingAnnualDividendRate,trailingAnnualDividendYield`;

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

    // Parse dividend info
    const exDivTimestamp = result.exDividendDate;
    let exDividendDate: string | null = null;
    let daysUntilExDiv: number | null = null;

    if (exDivTimestamp) {
      const date = new Date(exDivTimestamp * 1000);
      exDividendDate = date.toISOString().split('T')[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);

      daysUntilExDiv = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // If ex-div date is in the past, set to null
      if (daysUntilExDiv < 0) {
        exDividendDate = null;
        daysUntilExDiv = null;
      }
    }

    const dividendAmount =
      result.dividendRate ||
      result.trailingAnnualDividendRate ||
      0;

    const dividendYield =
      (result.dividendYield || result.trailingAnnualDividendYield || 0) * 100;

    // Cache for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

    res.status(200).json({
      symbol: upperSymbol,
      exDividendDate,
      dividendAmount,
      dividendYield: Math.round(dividendYield * 100) / 100,
      daysUntilExDiv,
    });
  } catch (error) {
    console.error('Error fetching dividends:', error);
    res.status(500).json({
      error: 'Failed to fetch dividend data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}



