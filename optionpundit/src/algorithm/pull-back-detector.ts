/**
 * Pull-Back Detector for V3.3 Algorithm
 *
 * @ported_from agrawal-estate/backend/app/modules/strategies/pull_back_detector.py
 * @source_version V3.3
 * @sync_date 2026-01-17
 *
 * Modifications:
 * - Uses NEW premium for cost validation (not original)
 * - Premium estimation when API unavailable
 * - Simplified without database/service dependencies
 *
 * V3.3 Change:
 * - Check positions >1 week out (was >2 weeks in V3.0)
 *
 * When a position was rolled far out (e.g., 8 weeks) to escape ITM, and the stock
 * drops back down, we may be able to "pull back" to a shorter expiration and
 * return to weekly income generation sooner.
 */

import { EarningsInfo, DividendInfo } from './types';
import { DEFAULT_CONFIG_V3, ROLL_DURATION_WEEKS, getFridayNWeeksOut } from './config';
import {
  isAcceptableCost,
  estimatePremium,
  findDeltaStrike,
  daysBetween,
} from './calculations';

/**
 * Result of pull-back opportunity check
 */
export interface PullBackResult {
  /** Current expiration date */
  fromExpiration: Date;

  /** Current weeks to expiration */
  fromWeeks: number;

  /** New expiration date */
  toExpiration: Date;

  /** New weeks to expiration */
  toWeeks: number;

  /** New strike price */
  newStrike: number;

  /** New premium estimate */
  newPremium: number;

  /** Current option value */
  currentValue: number;

  /** Net cost (positive = debit) */
  netCost: number;

  /** Total cost for all contracts */
  netCostTotal: number;

  /** Weeks saved by pulling back */
  weeksSaved: number;

  /** Whether cost is acceptable */
  acceptable: boolean;

  /** Benefit description */
  benefit: string;
}

/**
 * Options for pull-back check
 */
export interface PullBackOptions {
  /** Stock symbol */
  symbol: string;

  /** Current option expiration */
  currentExpiration: Date;

  /** Current option strike */
  currentStrike: number;

  /** Option type */
  optionType: 'call' | 'put';

  /** Current option value (buy-back cost) */
  currentPremium: number;

  /** Current stock price */
  currentPrice: number;

  /** Number of contracts */
  contracts?: number;

  /** Weekly volatility for estimation */
  weeklyVolatility?: number;

  /** Earnings info (to skip earnings weeks) */
  earningsInfo?: EarningsInfo;

  /** Dividend info (to skip ex-div weeks) */
  dividendInfo?: DividendInfo;
}

/**
 * Check if far-dated position can return to shorter expiration at cost-neutral.
 *
 * Scans ALL intermediate expirations between 1 week and current expiration.
 * Returns FIRST (shortest) expiration achieving cost-neutral.
 *
 * V3 Addendum: Uses Delta 30 for pull-backs (same as ITM escapes).
 *
 * OPTIONPUNDIT MODIFICATION:
 * Uses 20% of NEW premium as max debit (not original premium).
 *
 * @param options - Pull-back options
 * @returns PullBackResult if opportunity found, null otherwise
 */
export function checkPullBackOpportunity(options: PullBackOptions): PullBackResult | null {
  const {
    symbol,
    currentExpiration,
    currentStrike,
    optionType,
    currentPremium,
    currentPrice,
    contracts = 1,
    weeklyVolatility = DEFAULT_CONFIG_V3.defaultWeeklyVolatility,
    earningsInfo,
    dividendInfo,
  } = options;

  const today = new Date();
  const currentWeeks = Math.max(1, Math.floor(daysBetween(today, currentExpiration) / 7));

  // Only check positions >1 week out (per V3 Addendum)
  if (currentWeeks <= 1) {
    return null;
  }

  console.log(
    `Pull-back check: ${symbol} $${currentStrike} ${optionType}, ` +
      `currentWeeks=${currentWeeks}, currentValue=$${currentPremium.toFixed(2)}`
  );

  // Check all intermediate expirations
  for (const weeks of ROLL_DURATION_WEEKS) {
    // Don't check expirations at or beyond current
    if (weeks >= currentWeeks) {
      break;
    }

    // Calculate target expiration
    const expiration = getFridayNWeeksOut(today, weeks);

    // Skip earnings week if we have earnings info
    if (earningsInfo?.earningsDate && shouldSkipForEarnings(expiration, earningsInfo.earningsDate)) {
      continue;
    }

    // Skip ex-dividend week if we have dividend info
    if (dividendInfo?.exDividendDate && shouldSkipForDividend(expiration, dividendInfo.exDividendDate)) {
      continue;
    }

    // Find strike at Delta 30 (per V3 Addendum)
    const newStrike = findDeltaStrike(
      currentPrice,
      optionType,
      0.30, // Delta 30 for pull-backs
      weeklyVolatility,
      weeks
    );

    // Estimate new premium
    const newPremium = estimatePremium(
      currentPrice,
      newStrike,
      weeks * 7,
      weeklyVolatility,
      optionType
    );

    // Skip if premium is too low
    if (newPremium < 0.05) {
      continue;
    }

    // Calculate net cost to pull back
    // We buy back current option (currentPremium) and sell new (newPremium)
    const netCost = currentPremium - newPremium;

    // Check if acceptable using V3 20% rule (of NEW premium)
    const costCheck = isAcceptableCost(netCost, newPremium);

    if (costCheck.acceptable) {
      // FOUND IT! Return immediately (shortest acceptable)
      const weeksSaved = currentWeeks - weeks;

      console.log(
        `Pull-back found: ${symbol} from ${currentWeeks}w to ${weeks}w, ` +
          `netCost=$${netCost.toFixed(2)}, weeksSaved=${weeksSaved}`
      );

      return {
        fromExpiration: currentExpiration,
        fromWeeks: currentWeeks,
        toExpiration: expiration,
        toWeeks: weeks,
        newStrike,
        newPremium,
        currentValue: currentPremium,
        netCost,
        netCostTotal: netCost * 100 * contracts,
        weeksSaved,
        acceptable: true,
        benefit: `Return to income ${weeksSaved} weeks early`,
      };
    }
  }

  // No cost-neutral pull-back available
  return null;
}

/**
 * Check if expiration should be skipped due to earnings week.
 */
function shouldSkipForEarnings(expiration: Date, earningsDate: Date): boolean {
  const earningsWeekStart = new Date(earningsDate);
  earningsWeekStart.setDate(earningsDate.getDate() - earningsDate.getDay() + 1);

  const earningsWeekEnd = new Date(earningsWeekStart);
  earningsWeekEnd.setDate(earningsWeekStart.getDate() + 6);

  return expiration >= earningsWeekStart && expiration <= earningsWeekEnd;
}

/**
 * Check if expiration should be skipped due to ex-dividend.
 */
function shouldSkipForDividend(expiration: Date, exDivDate: Date): boolean {
  const daysDiff = Math.abs(daysBetween(expiration, exDivDate));
  return daysDiff <= 2;
}

/**
 * Async version that fetches market data.
 */
export async function checkPullBackOpportunityAsync(
  options: PullBackOptions,
  fetchEarnings?: (symbol: string) => Promise<EarningsInfo | null>,
  fetchDividends?: (symbol: string) => Promise<DividendInfo | null>
): Promise<PullBackResult | null> {
  let earningsInfo = options.earningsInfo;
  let dividendInfo = options.dividendInfo;

  if (!earningsInfo && fetchEarnings) {
    earningsInfo = (await fetchEarnings(options.symbol)) ?? undefined;
  }

  if (!dividendInfo && fetchDividends) {
    dividendInfo = (await fetchDividends(options.symbol)) ?? undefined;
  }

  return checkPullBackOpportunity({
    ...options,
    earningsInfo,
    dividendInfo,
  });
}

