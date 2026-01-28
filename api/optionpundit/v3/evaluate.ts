/**
 * Vercel Serverless Function: V3.3 Algorithm Evaluation
 *
 * This is the V3.3 algorithm endpoint. It evaluates positions and sold options
 * to generate recommendations.
 *
 * Usage: POST /api/v3/evaluate
 *
 * Request Body:
 * {
 *   "positions": [{ "symbol": "AAPL", "shares": 100, "currentPrice": 175 }],
 *   "soldOptions": [{ "symbol": "AAPL", "strike": 180, "expiration": "2026-02-07", ... }]
 * }
 *
 * Response:
 * {
 *   "version": "3.3",
 *   "recommendations": [...],
 *   "summary": { "total": 5, "urgent": 1, "high": 2, ... }
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// TYPES
// ============================================================================

interface Position {
  symbol: string;
  shares: number;
  currentPrice?: number;
  avgCost?: number;
}

interface SoldOption {
  symbol: string;
  strike: number;
  expiration: string;
  premium: number;
  currentPremium?: number;
  contracts: number;
  optionType: 'call' | 'put';
}

interface MarketQuote {
  symbol: string;
  currentPrice: number;
  change?: number;
  changePercent?: number;
  bid?: number;
  ask?: number;
}

type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'info';

type V3ActionType =
  | 'PULL_BACK'
  | 'ROLL_ITM'
  | 'COMPRESS'
  | 'MONITOR'
  | 'NEAR_ITM_WARNING'
  | 'ROLL_WEEKLY'
  | 'CLOSE_CATASTROPHIC'
  | 'SELL_NEW'
  | 'NO_ACTION';

interface Recommendation {
  id: string;
  symbol: string;
  action: V3ActionType;
  priority: Priority;
  title: string;
  description: string;
  currentStrike?: number;
  currentExpiration?: string;
  newStrike?: number;
  newExpiration?: string;
  newPremium?: number;
  netCost?: number;
  itmPercent?: number;
  otmPercent?: number;
  daysToExpiration?: number;
  weeksToRoll?: number;
  weeksSaved?: number;
  probabilityOtm?: number;
  executionSteps: string[];
  createdAt: string;
}

interface EvaluateRequest {
  positions: Position[];
  soldOptions: SoldOption[];
}

interface EvaluateResponse {
  version: string;
  recommendations: Recommendation[];
  summary: {
    total: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
    byAction: Record<string, number>;
  };
  quotesUsed: Record<string, number>;
}

// ============================================================================
// CONFIGURATION (V3.3)
// ============================================================================

const CONFIG = {
  profitThreshold: 0.60,           // 60% profit triggers roll
  maxDebitPct: 0.20,               // Max 20% of new premium as debit
  maxRollMonths: 12,               // Search up to 12 months for escape
  deltaTargetWeekly: 0.90,         // Delta 10 (90% OTM) for weekly
  deltaTargetItm: 0.70,            // Delta 30 (70% OTM) for ITM escape
  minWeeksForPullback: 1,          // V3.3: Check positions >1 week
  itmCompressThresholdDays: 60,    // >60 days = compress not escape
  nearItmThresholdPct: 2.0,        // Alert when within 2%
  weeklyVolatility: 0.03,          // Default weekly volatility (3%)
};

const ROLL_DURATION_WEEKS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 36, 52];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function daysBetween(date1: Date, date2: Date): number {
  const ms = date2.getTime() - date1.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateMedium(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatPercent(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

function getNextFriday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFriday);
  return d;
}

function getFridayNWeeksOut(weeks: number, from: Date = new Date()): Date {
  const friday = getNextFriday(from);
  friday.setDate(friday.getDate() + (weeks - 1) * 7);
  return friday;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateItmStatus(
  currentPrice: number,
  strike: number,
  optionType: 'call' | 'put'
): { isItm: boolean; itmPct: number; otmPct: number; intrinsicValue: number } {
  let isItm: boolean;
  let intrinsicValue: number;

  if (optionType === 'call') {
    isItm = currentPrice > strike;
    intrinsicValue = Math.max(0, currentPrice - strike);
  } else {
    isItm = currentPrice < strike;
    intrinsicValue = Math.max(0, strike - currentPrice);
  }

  const distancePct = Math.abs(currentPrice - strike) / strike * 100;

  return {
    isItm,
    itmPct: isItm ? distancePct : 0,
    otmPct: isItm ? 0 : distancePct,
    intrinsicValue,
  };
}

function estimatePremium(
  currentPrice: number,
  strike: number,
  daysToExp: number,
  weeklyVol: number,
  optionType: 'call' | 'put'
): number {
  const weeksToExp = daysToExp / 7;
  const timeValue = currentPrice * weeklyVol * Math.sqrt(weeksToExp) * 0.5;

  // Adjust for moneyness
  const { isItm, intrinsicValue, otmPct } = calculateItmStatus(currentPrice, strike, optionType);

  if (isItm) {
    return intrinsicValue + timeValue;
  }

  // OTM: reduce premium based on distance
  const otmFactor = Math.max(0.2, 1 - otmPct / 20);
  return timeValue * otmFactor;
}

function estimateDelta(
  currentPrice: number,
  strike: number,
  optionType: 'call' | 'put'
): number {
  const moneyness = (currentPrice - strike) / strike;

  if (optionType === 'call') {
    if (moneyness > 0.1) return 0.9;      // Deep ITM
    if (moneyness > 0.05) return 0.7;     // ITM
    if (moneyness > 0) return 0.55;       // Slightly ITM
    if (moneyness > -0.03) return 0.45;   // ATM
    if (moneyness > -0.05) return 0.30;   // Delta 30
    if (moneyness > -0.08) return 0.15;   // Delta 15
    return 0.10;                          // Delta 10 OTM
  } else {
    if (moneyness < -0.1) return 0.9;
    if (moneyness < -0.05) return 0.7;
    if (moneyness < 0) return 0.55;
    if (moneyness < 0.03) return 0.45;
    if (moneyness < 0.05) return 0.30;
    if (moneyness < 0.08) return 0.15;
    return 0.10;
  }
}

function findDeltaStrike(
  currentPrice: number,
  optionType: 'call' | 'put',
  deltaTarget: number
): number {
  // Approximate strike for target delta
  const offset = deltaTarget <= 0.15 ? 0.05 : deltaTarget <= 0.35 ? 0.03 : 0;

  if (optionType === 'call') {
    return Math.ceil(currentPrice * (1 + offset) / 5) * 5;
  } else {
    return Math.floor(currentPrice * (1 - offset) / 5) * 5;
  }
}

// ============================================================================
// ZERO-COST ROLL FINDER
// ============================================================================

interface ZeroCostRollResult {
  expirationDate: Date;
  weeksOut: number;
  strike: number;
  newPremium: number;
  netCost: number;
  probabilityOtm: number;
  isCredit: boolean;
  acceptable: boolean;
}

function findZeroCostRoll(
  currentPrice: number,
  currentPremium: number,
  optionType: 'call' | 'put',
  useItmDelta: boolean
): ZeroCostRollResult | null {
  const today = new Date();
  const deltaTarget = useItmDelta ? 0.30 : 0.10;

  for (const weeks of ROLL_DURATION_WEEKS) {
    const expDate = getFridayNWeeksOut(weeks, today);
    const daysToExp = daysBetween(today, expDate);

    const strike = findDeltaStrike(currentPrice, optionType, deltaTarget);
    const newPremium = estimatePremium(currentPrice, strike, daysToExp, CONFIG.weeklyVolatility, optionType);
    const netCost = currentPremium - newPremium;

    // Check if acceptable: debit <= 20% of new premium
    const maxDebit = newPremium * CONFIG.maxDebitPct;
    const acceptable = netCost <= maxDebit;

    if (acceptable) {
      const delta = estimateDelta(currentPrice, strike, optionType);
      return {
        expirationDate: expDate,
        weeksOut: weeks,
        strike,
        newPremium,
        netCost,
        probabilityOtm: (1 - delta) * 100,
        isCredit: netCost < 0,
        acceptable,
      };
    }
  }

  return null;
}

// ============================================================================
// PULL-BACK DETECTOR
// ============================================================================

interface PullBackResult {
  fromWeeks: number;
  toWeeks: number;
  fromExpiration: Date;
  toExpiration: Date;
  newStrike: number;
  newPremium: number;
  currentValue: number;
  netCost: number;
  weeksSaved: number;
}

function checkPullBackOpportunity(
  currentPrice: number,
  strike: number,
  expiration: string,
  currentPremium: number,
  optionType: 'call' | 'put'
): PullBackResult | null {
  const today = new Date();
  const expDate = parseDate(expiration);
  const daysToExp = daysBetween(today, expDate);
  const weeksToExp = Math.ceil(daysToExp / 7);

  // Only check if position is >1 week out (V3.3)
  if (weeksToExp <= CONFIG.minWeeksForPullback) return null;

  // Check if OTM
  const { isItm } = calculateItmStatus(currentPrice, strike, optionType);
  if (isItm) return null;

  // Try to pull back to 1 week
  const targetWeeks = 1;
  const targetExpDate = getFridayNWeeksOut(targetWeeks, today);
  const targetDaysToExp = daysBetween(today, targetExpDate);

  const newStrike = findDeltaStrike(currentPrice, optionType, 0.30); // Delta 30
  const newPremium = estimatePremium(currentPrice, newStrike, targetDaysToExp, CONFIG.weeklyVolatility, optionType);
  const netCost = currentPremium - newPremium;

  // Check if cost-neutral or credit
  if (netCost > newPremium * CONFIG.maxDebitPct) return null;

  return {
    fromWeeks: weeksToExp,
    toWeeks: targetWeeks,
    fromExpiration: expDate,
    toExpiration: targetExpDate,
    newStrike,
    newPremium,
    currentValue: currentPremium,
    netCost,
    weeksSaved: weeksToExp - targetWeeks,
  };
}

// ============================================================================
// POSITION EVALUATION
// ============================================================================

function evaluateSoldOption(
  option: SoldOption,
  currentPrice: number
): Recommendation | null {
  const today = new Date();
  const expDate = parseDate(option.expiration);
  const daysToExp = daysBetween(today, expDate);

  // Skip expired options
  if (daysToExp < 0) return null;

  const { isItm, itmPct, otmPct } = calculateItmStatus(currentPrice, option.strike, option.optionType);
  const currentPremium = option.currentPremium ?? estimatePremium(
    currentPrice, option.strike, daysToExp, CONFIG.weeklyVolatility, option.optionType
  );
  const profitPct = option.premium > 0 ? (option.premium - currentPremium) / option.premium : 0;

  const baseId = `${option.symbol}_${option.strike}_${option.optionType}`;

  // ========== STATE 1: PULL-BACK ==========
  if (!isItm && daysToExp > 7) {
    const pullBack = checkPullBackOpportunity(
      currentPrice, option.strike, option.expiration, currentPremium, option.optionType
    );

    if (pullBack) {
      return {
        id: `pullback_${baseId}_${Date.now()}`,
        symbol: option.symbol,
        action: 'PULL_BACK',
        priority: 'medium',
        title: `PULL BACK ${option.symbol} from ${pullBack.fromWeeks}w → ${pullBack.toWeeks}w (save ${pullBack.weeksSaved} weeks)`,
        description: `Position is OTM and can return to shorter duration. Resume weekly income generation faster.`,
        currentStrike: option.strike,
        currentExpiration: option.expiration,
        newStrike: pullBack.newStrike,
        newExpiration: formatDateISO(pullBack.toExpiration),
        newPremium: pullBack.newPremium,
        netCost: pullBack.netCost,
        otmPercent: otmPct,
        daysToExpiration: daysToExp,
        weeksSaved: pullBack.weeksSaved,
        executionSteps: [
          `Buy to close current $${option.strike} ${option.optionType} at ~${formatCurrency(currentPremium)}`,
          `Sell $${pullBack.newStrike} ${option.optionType} for ${formatDateMedium(pullBack.toExpiration)} at ~${formatCurrency(pullBack.newPremium)}`,
          `Net: ${pullBack.netCost > 0 ? formatCurrency(pullBack.netCost) + ' debit' : formatCurrency(Math.abs(pullBack.netCost)) + ' credit'}`,
          `Save ${pullBack.weeksSaved} weeks - resume weekly income faster`,
        ],
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ========== STATE 2: ITM HANDLING ==========
  if (isItm && itmPct >= 1.0) {
    // V3.3: Split by duration - far-dated (>60 days) = COMPRESS, near-dated = ESCAPE
    const action: V3ActionType = daysToExp > CONFIG.itmCompressThresholdDays ? 'COMPRESS' : 'ROLL_ITM';

    const zeroCost = findZeroCostRoll(currentPrice, currentPremium, option.optionType, true);

    if (zeroCost) {
      const priority: Priority = itmPct >= 5 ? 'urgent' : 'high';

      return {
        id: `${action.toLowerCase()}_${baseId}_${Date.now()}`,
        symbol: option.symbol,
        action,
        priority,
        title: `${action === 'COMPRESS' ? 'COMPRESS' : 'ROLL'} ITM ${option.symbol} $${option.strike}→$${zeroCost.strike} (${zeroCost.weeksOut}w)`,
        description: `${option.symbol} is ${formatPercent(itmPct)} ITM. ${action === 'COMPRESS' ? 'Compressing far-dated position.' : 'Rolling to escape ITM.'}`,
        currentStrike: option.strike,
        currentExpiration: option.expiration,
        newStrike: zeroCost.strike,
        newExpiration: formatDateISO(zeroCost.expirationDate),
        newPremium: zeroCost.newPremium,
        netCost: zeroCost.netCost,
        itmPercent: itmPct,
        daysToExpiration: daysToExp,
        weeksToRoll: zeroCost.weeksOut,
        probabilityOtm: zeroCost.probabilityOtm,
        executionSteps: [
          `Buy to close $${option.strike} ${option.optionType} at ~${formatCurrency(currentPremium)}`,
          `Sell $${zeroCost.strike} ${option.optionType} for ${formatDateMedium(zeroCost.expirationDate)} at ~${formatCurrency(zeroCost.newPremium)}`,
          `Net: ${zeroCost.isCredit ? 'Credit' : 'Debit'} of ${formatCurrency(Math.abs(zeroCost.netCost))}/share`,
          `New position: ${formatPercent(zeroCost.probabilityOtm)} probability OTM`,
        ],
        createdAt: new Date().toISOString(),
      };
    }

    // V3.3: If no zero-cost roll found, MONITOR instead of CATASTROPHIC for slight ITM
    if (itmPct <= 8 && daysToExp >= 5) {
      return {
        id: `monitor_${baseId}_${Date.now()}`,
        symbol: option.symbol,
        action: 'MONITOR',
        priority: 'medium',
        title: `MONITOR ${option.symbol} - ${formatPercent(itmPct)} ITM, ${daysToExp} days left`,
        description: `Position is slightly ITM. Wait for mean reversion before taking action.`,
        currentStrike: option.strike,
        currentExpiration: option.expiration,
        itmPercent: itmPct,
        daysToExpiration: daysToExp,
        executionSteps: [
          `Hold current position and monitor for mean reversion`,
          `Stock may recover before expiration`,
          `Check back in 2-3 days for updated recommendation`,
        ],
        createdAt: new Date().toISOString(),
      };
    }

    // No escape possible - catastrophic
    return {
      id: `catastrophic_${baseId}_${Date.now()}`,
      symbol: option.symbol,
      action: 'CLOSE_CATASTROPHIC',
      priority: 'urgent',
      title: `CATASTROPHIC: ${option.symbol} ${formatPercent(itmPct)} ITM - No escape`,
      description: `No cost-neutral roll available within ${CONFIG.maxRollMonths} months. Consider closing.`,
      currentStrike: option.strike,
      currentExpiration: option.expiration,
      itmPercent: itmPct,
      daysToExpiration: daysToExp,
      executionSteps: [
        `Consider closing this position to cut losses`,
        `No cost-neutral roll available within ${CONFIG.maxRollMonths} months`,
        `Alternative: Wait for stock to recover if you believe it will`,
      ],
      createdAt: new Date().toISOString(),
    };
  }

  // ========== STATE 3: NEAR ITM WARNING ==========
  if (!isItm && otmPct <= CONFIG.nearItmThresholdPct && daysToExp > 2) {
    const zeroCost = findZeroCostRoll(currentPrice, currentPremium, option.optionType, true);

    return {
      id: `nearitm_${baseId}_${Date.now()}`,
      symbol: option.symbol,
      action: 'NEAR_ITM_WARNING',
      priority: 'high',
      title: `WARNING: ${option.symbol} ${formatPercent(otmPct)} from strike`,
      description: `Stock is approaching your $${option.strike} strike. Consider preemptive action.`,
      currentStrike: option.strike,
      currentExpiration: option.expiration,
      newStrike: zeroCost?.strike,
      newExpiration: zeroCost ? formatDateISO(zeroCost.expirationDate) : undefined,
      newPremium: zeroCost?.newPremium,
      netCost: zeroCost?.netCost,
      otmPercent: otmPct,
      daysToExpiration: daysToExp,
      weeksToRoll: zeroCost?.weeksOut,
      executionSteps: [
        `Monitor closely - stock only ${formatPercent(otmPct)} from strike`,
        zeroCost ? `Consider rolling to $${zeroCost.strike} for ${formatDateMedium(zeroCost.expirationDate)}` : 'Evaluate roll options',
        `Act before position goes ITM to avoid losses`,
      ],
      createdAt: new Date().toISOString(),
    };
  }

  // ========== STATE 4: PROFITABLE - ROLL WEEKLY ==========
  if (profitPct >= CONFIG.profitThreshold) {
    const nextFriday = getNextFriday();
    const newDaysToExp = daysBetween(today, nextFriday);
    const newStrike = findDeltaStrike(currentPrice, option.optionType, 0.10); // Delta 10
    const newPremium = estimatePremium(currentPrice, newStrike, newDaysToExp, CONFIG.weeklyVolatility, option.optionType);
    const netCost = currentPremium - newPremium;

    const priority: Priority = daysToExp <= 1 ? 'urgent' : profitPct >= 0.90 ? 'high' : 'medium';

    return {
      id: `weekly_${baseId}_${Date.now()}`,
      symbol: option.symbol,
      action: 'ROLL_WEEKLY',
      priority,
      title: `ROLL ${option.symbol} $${option.strike}→$${newStrike} (${formatPercent(profitPct * 100)} profit)`,
      description: `${formatPercent(profitPct * 100)} profit captured. Roll to next week for continued income.`,
      currentStrike: option.strike,
      currentExpiration: option.expiration,
      newStrike,
      newExpiration: formatDateISO(nextFriday),
      newPremium,
      netCost,
      otmPercent: otmPct,
      daysToExpiration: daysToExp,
      probabilityOtm: 90,
      executionSteps: [
        `Buy to close $${option.strike} ${option.optionType} at ~${formatCurrency(currentPremium)}`,
        `Sell $${newStrike} ${option.optionType} for ${formatDateMedium(nextFriday)} at ~${formatCurrency(newPremium)}`,
        `Net: ${netCost > 0 ? formatCurrency(netCost) + ' debit' : formatCurrency(Math.abs(netCost)) + ' credit'}`,
        `Delta 10 = ~90% probability OTM`,
      ],
      createdAt: new Date().toISOString(),
    };
  }

  // No action needed
  return null;
}

function evaluateStockForNewCall(
  position: Position,
  currentPrice: number,
  soldOptionsForSymbol: SoldOption[]
): Recommendation | null {
  // Calculate covered contracts
  const maxContracts = Math.floor(position.shares / 100);
  const soldContracts = soldOptionsForSymbol.reduce((sum, o) => sum + o.contracts, 0);
  const unsoldContracts = maxContracts - soldContracts;

  if (unsoldContracts <= 0) return null;

  const today = new Date();
  const nextFriday = getNextFriday();
  const daysToExp = daysBetween(today, nextFriday);

  const strike = findDeltaStrike(currentPrice, 'call', 0.10); // Delta 10
  const premium = estimatePremium(currentPrice, strike, daysToExp, CONFIG.weeklyVolatility, 'call');
  const weeklyIncome = premium * unsoldContracts * 100;
  const yearlyIncome = weeklyIncome * 50;

  const otmPct = ((strike - currentPrice) / currentPrice) * 100;

  const priority: Priority = yearlyIncome >= 5000 ? 'high' : 'medium';

  return {
    id: `sellnew_${position.symbol}_${Date.now()}`,
    symbol: position.symbol,
    action: 'SELL_NEW',
    priority,
    title: `SELL ${unsoldContracts} ${position.symbol} call(s) at $${strike} (${formatCurrency(weeklyIncome)}/week)`,
    description: `${position.shares} shares can support ${maxContracts} contracts. ${soldContracts} sold, ${unsoldContracts} available. Generate ~${formatCurrency(yearlyIncome)}/year.`,
    newStrike: strike,
    newExpiration: formatDateISO(nextFriday),
    newPremium: premium,
    otmPercent: otmPct,
    daysToExpiration: daysToExp,
    probabilityOtm: 90,
    executionSteps: [
      `Sell ${unsoldContracts}x ${position.symbol} $${strike} call for ${formatDateMedium(nextFriday)}`,
      `Strike is ${formatPercent(otmPct)} OTM (Delta ~10, ~90% win rate)`,
      `Estimated premium: ~${formatCurrency(premium)}/share`,
      `Total weekly income: ~${formatCurrency(weeklyIncome)}`,
    ],
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// MARKET DATA FETCHER
// ============================================================================

async function fetchQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
  const quotes = new Map<string, MarketQuote>();

  if (symbols.length === 0) return quotes;

  const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${uniqueSymbols.join(',')}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OptionPundit/1.0)' },
    });

    if (!response.ok) throw new Error(`Yahoo Finance error: ${response.status}`);

    const data = await response.json();
    const results = data?.quoteResponse?.result || [];

    for (const result of results) {
      quotes.set(result.symbol, {
        symbol: result.symbol,
        currentPrice: result.regularMarketPrice ?? 0,
        change: result.regularMarketChange ?? 0,
        changePercent: result.regularMarketChangePercent ?? 0,
        bid: result.bid ?? 0,
        ask: result.ask ?? 0,
      });
    }
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
  }

  return quotes;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { positions, soldOptions } = req.body as EvaluateRequest;

    if (!positions || !Array.isArray(positions)) {
      res.status(400).json({ error: 'Missing or invalid "positions" array' });
      return;
    }

    if (!soldOptions || !Array.isArray(soldOptions)) {
      res.status(400).json({ error: 'Missing or invalid "soldOptions" array' });
      return;
    }

    // Gather all symbols
    const symbolSet = new Set<string>();
    positions.forEach(p => symbolSet.add(p.symbol.toUpperCase()));
    soldOptions.forEach(o => symbolSet.add(o.symbol.toUpperCase()));
    const symbols = Array.from(symbolSet);

    // Fetch market quotes
    const quotes = await fetchQuotes(symbols);

    // Evaluate positions
    const recommendations: Recommendation[] = [];
    const quotesUsed: Record<string, number> = {};

    // Evaluate sold options
    for (const option of soldOptions) {
      const symbol = option.symbol.toUpperCase();
      const quote = quotes.get(symbol);
      const currentPrice = option.currentPremium ? undefined : quote?.currentPrice;

      if (!currentPrice && !option.currentPremium) continue;

      quotesUsed[symbol] = currentPrice ?? 0;

      const rec = evaluateSoldOption(option, currentPrice ?? 0);
      if (rec) recommendations.push(rec);
    }

    // Evaluate stock holdings for new covered calls
    const symbolsWithOptions = new Set(soldOptions.map(o => o.symbol.toUpperCase()));

    for (const position of positions) {
      const symbol = position.symbol.toUpperCase();
      const quote = quotes.get(symbol);
      const currentPrice = position.currentPrice ?? quote?.currentPrice;

      if (!currentPrice) continue;

      quotesUsed[symbol] = currentPrice;

      const optionsForSymbol = soldOptions.filter(o => o.symbol.toUpperCase() === symbol);
      const rec = evaluateStockForNewCall(position, currentPrice, optionsForSymbol);
      if (rec) recommendations.push(rec);
    }

    // Sort by priority
    const priorityOrder: Record<Priority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Build summary
    const summary = {
      total: recommendations.length,
      urgent: recommendations.filter(r => r.priority === 'urgent').length,
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length,
      byAction: recommendations.reduce((acc, r) => {
        acc[r.action] = (acc[r.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const response: EvaluateResponse = {
      version: '3.3',
      recommendations,
      summary,
      quotesUsed,
    };

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(response);

  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({
      error: 'Evaluation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
