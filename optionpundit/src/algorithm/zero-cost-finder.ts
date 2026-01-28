/**
 * Zero-Cost Roll Finder
 *
 * @ported_from agrawal-estate/backend/app/modules/strategies/zero_cost_finder.py
 * @source_version V3.2
 * @sync_date 2026-01-17
 *
 * Modifications:
 * - Uses NEW premium for cost validation (not original)
 * - Premium estimation when API unavailable
 * - Async-ready for market data fetching
 * - Simplified without database/service dependencies
 *
 * V3.2 Enhancement (Agrawal Estate):
 * - Backend searches ALL OTM strikes to find cheapest acceptable roll
 * - Instead of only checking delta-target strike, iterates through all OTM
 *
 * OptionPundit Client-Side Note:
 * - Uses estimation since we don't have real options chain data
 * - Delta-target approach is used as proxy for "best" OTM strike
 * - When real API is available, can switch to full strike search
 */

import { EarningsInfo, DividendInfo, OptionsChain } from './types';
import { DEFAULT_CONFIG_V3, ROLL_DURATION_WEEKS, getFridayNWeeksOut } from './config';
import {
  isAcceptableCost,
  estimatePremium,
  findDeltaStrike,
  estimateDelta,
  daysBetween,
  formatDateISO,
} from './calculations';

/**
 * Result of zero-cost roll search
 */
export interface ZeroCostRollResult {
  /** Target expiration date */
  expirationDate: Date;

  /** Weeks out from today */
  weeksOut: number;

  /** Recommended strike price */
  strike: number;

  /** New premium estimate */
  newPremium: number;

  /** Cost to buy back current position */
  buyBackCost: number;

  /** Net cost (positive = debit, negative = credit) */
  netCost: number;

  /** Total cost for all contracts */
  netCostTotal: number;

  /** Probability of staying OTM */
  probabilityOtm: number;

  /** Estimated delta */
  delta: number;

  /** Whether roll results in credit */
  isCredit: boolean;

  /** Whether cost is acceptable */
  acceptable: boolean;

  /** Strike distance from current price (%) */
  strikeDistancePct: number;

  /** Days to expiration */
  daysToExpiry: number;

  /** Current stock price */
  currentPrice: number;
}

/**
 * Options for zero-cost roll search
 */
export interface ZeroCostFinderOptions {
  /** Stock symbol */
  symbol: string;

  /** Current option strike */
  currentStrike: number;

  /** Option type */
  optionType: 'call' | 'put';

  /** Current option expiration */
  currentExpiration: Date;

  /** Current stock price */
  currentPrice: number;

  /** Cost to buy back current position (per share) */
  buyBackCost: number;

  /** Number of contracts */
  contracts?: number;

  /** Maximum months to search (default 12) */
  maxMonths?: number;

  /** Target delta (0.70 for ITM, 0.90 for weekly) */
  deltaTarget?: number;

  /** Weekly volatility for estimation */
  weeklyVolatility?: number;

  /** Earnings info (to skip earnings weeks) */
  earningsInfo?: EarningsInfo;

  /** Dividend info (to skip ex-div weeks) */
  dividendInfo?: DividendInfo;

  /** Options chain data if available */
  optionsChain?: OptionsChain;
}

/**
 * V3: Find SHORTEST duration achieving zero-cost roll.
 *
 * Scans expirations sequentially from 1 week to maxMonths.
 * Returns the FIRST acceptable roll (not the "best" scored).
 *
 * OPTIONPUNDIT MODIFICATION:
 * Uses 20% of NEW premium as max debit (not original premium).
 *
 * @param options - Search options
 * @returns ZeroCostRollResult if found, null if no acceptable roll
 */
export function findZeroCostRoll(
  options: ZeroCostFinderOptions
): ZeroCostRollResult | null {
  const {
    symbol,
    currentStrike,
    optionType,
    currentExpiration,
    currentPrice,
    buyBackCost,
    contracts = 1,
    maxMonths = DEFAULT_CONFIG_V3.maxRollMonths,
    deltaTarget = DEFAULT_CONFIG_V3.deltaTargetItm,
    weeklyVolatility = DEFAULT_CONFIG_V3.defaultWeeklyVolatility,
    earningsInfo,
    dividendInfo,
  } = options;

  const today = new Date();
  const maxWeeks = maxMonths * 4;

  // Filter scan durations to max weeks
  const scanWeeks = ROLL_DURATION_WEEKS.filter((w) => w <= maxWeeks);

  console.log(
    `Zero-cost finder: ${symbol} $${currentStrike} ${optionType}, ` +
      `buyBack=$${buyBackCost.toFixed(2)}, deltaTarget=${deltaTarget}, maxWeeks=${maxWeeks}`
  );

  for (const weeks of scanWeeks) {
    // Calculate target expiration (Friday of that week)
    const expiration = getFridayNWeeksOut(today, weeks);

    // Skip if before or same as current expiration
    if (expiration <= currentExpiration) {
      continue;
    }

    // Skip earnings week if we have earnings info
    if (earningsInfo?.earningsDate && shouldSkipForEarnings(expiration, earningsInfo.earningsDate)) {
      continue;
    }

    // Skip ex-dividend week if we have dividend info
    if (dividendInfo?.exDividendDate && shouldSkipForDividend(expiration, dividendInfo.exDividendDate)) {
      continue;
    }

    // Find strike at target delta
    const newStrike = findDeltaStrike(
      currentPrice,
      optionType,
      1 - deltaTarget, // Convert probability to delta
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

    // Calculate net cost
    const netCost = buyBackCost - newPremium;

    // Check if acceptable using V3 20% rule (of NEW premium)
    const costCheck = isAcceptableCost(netCost, newPremium);

    if (costCheck.acceptable) {
      // FOUND IT! Return immediately (shortest acceptable)
      const daysToExpiry = daysBetween(today, expiration);
      const delta = estimateDelta(currentPrice, newStrike, daysToExpiry, weeklyVolatility, optionType);
      const probabilityOtm = (1 - Math.abs(delta)) * 100;

      // Calculate strike distance
      let strikeDistancePct: number;
      if (optionType === 'call') {
        strikeDistancePct = ((newStrike - currentPrice) / currentPrice) * 100;
      } else {
        strikeDistancePct = ((currentPrice - newStrike) / currentPrice) * 100;
      }

      console.log(
        `Zero-cost found: ${weeks}w ${formatDateISO(expiration)} $${newStrike} ` +
          `netCost=$${netCost.toFixed(2)}`
      );

      return {
        expirationDate: expiration,
        weeksOut: weeks,
        strike: newStrike,
        newPremium,
        buyBackCost,
        netCost,
        netCostTotal: netCost * 100 * contracts,
        probabilityOtm,
        delta,
        isCredit: netCost < 0,
        acceptable: true,
        strikeDistancePct,
        daysToExpiry,
        currentPrice,
      };
    }
  }

  // Could not find acceptable roll within max months
  console.warn(
    `No zero-cost roll found for ${symbol} $${currentStrike} ${optionType} within ${maxMonths} months`
  );
  return null;
}

/**
 * Check if expiration should be skipped due to earnings week.
 * V3 Addendum: Skip ONLY the earnings week itself.
 */
function shouldSkipForEarnings(expiration: Date, earningsDate: Date): boolean {
  // Get week boundaries (Monday to Sunday)
  const earningsWeekStart = new Date(earningsDate);
  earningsWeekStart.setDate(earningsDate.getDate() - earningsDate.getDay() + 1); // Monday

  const earningsWeekEnd = new Date(earningsWeekStart);
  earningsWeekEnd.setDate(earningsWeekStart.getDate() + 6); // Sunday

  return expiration >= earningsWeekStart && expiration <= earningsWeekEnd;
}

/**
 * Check if expiration should be skipped due to ex-dividend.
 * Skip if within 2 days of ex-dividend date.
 */
function shouldSkipForDividend(expiration: Date, exDivDate: Date): boolean {
  const daysDiff = Math.abs(daysBetween(expiration, exDivDate));
  return daysDiff <= 2;
}

/**
 * Async version of findZeroCostRoll that fetches market data.
 * Use this when API is available.
 */
export async function findZeroCostRollAsync(
  options: ZeroCostFinderOptions,
  _fetchOptionsChain?: (symbol: string, expiration: string) => Promise<OptionsChain | null>,
  fetchEarnings?: (symbol: string) => Promise<EarningsInfo | null>,
  fetchDividends?: (symbol: string) => Promise<DividendInfo | null>
): Promise<ZeroCostRollResult | null> {
  // Fetch earnings and dividend info if not provided
  let earningsInfo = options.earningsInfo;
  let dividendInfo = options.dividendInfo;

  if (!earningsInfo && fetchEarnings) {
    earningsInfo = (await fetchEarnings(options.symbol)) ?? undefined;
  }

  if (!dividendInfo && fetchDividends) {
    dividendInfo = (await fetchDividends(options.symbol)) ?? undefined;
  }

  // For now, use the sync version with estimated premiums
  // When API is ready, we'll fetch real option chains here
  return findZeroCostRoll({
    ...options,
    earningsInfo,
    dividendInfo,
  });
}

