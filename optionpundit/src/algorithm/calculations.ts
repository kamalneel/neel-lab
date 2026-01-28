/**
 * Option Calculations Utility Module
 *
 * @ported_from agrawal-estate/backend/app/modules/strategies/utils/option_calculations.py
 * @source_version V3.3
 * @sync_date 2026-01-17
 *
 * Modifications:
 * - Cost rule uses NEW premium (not original) since original isn't available
 * - Removed legacy compatibility functions
 * - Added premium estimation function
 */

import { ItmStatus } from './types';
import { DEFAULT_CONFIG_V3 } from './config';

// =============================================================================
// V3 CONFIGURATION - Modified for OptionPundit
// =============================================================================

/**
 * V3: Max debit is 20% of NEW premium (OptionPundit modification)
 * Original uses 20% of original premium, but we don't have that data
 */
const MAX_DEBIT_PCT = 0.20;

// =============================================================================
// ITM STATUS CALCULATION
// =============================================================================

/**
 * Calculate ITM status, percentage, and intrinsic value for an option.
 *
 * This is the SINGLE SOURCE OF TRUTH for ITM calculations.
 *
 * @param currentPrice - Current stock price
 * @param strike - Option strike price
 * @param optionType - 'call' or 'put'
 * @returns ITM status object
 *
 * @example
 * calculateItmStatus(102.0, 100.0, 'call')
 * // { isItm: true, itmPct: 2.0, intrinsicValue: 2.0, ... }
 *
 * @example
 * calculateItmStatus(39.0, 60.0, 'put')  // Deep ITM put
 * // { isItm: true, itmPct: 35.0, intrinsicValue: 21.0, ... }
 */
export function calculateItmStatus(
  currentPrice: number,
  strike: number,
  optionType: 'call' | 'put'
): ItmStatus {
  const optionTypeLower = optionType.toLowerCase() as 'call' | 'put';

  let isItm: boolean;
  let itmPct: number;
  let otmPct: number;
  let intrinsicValue: number;

  if (optionTypeLower === 'call') {
    // CALL: ITM when stock > strike
    isItm = currentPrice > strike;
    if (isItm) {
      intrinsicValue = currentPrice - strike;
      itmPct = (intrinsicValue / strike) * 100;
      otmPct = 0;
    } else {
      intrinsicValue = 0;
      itmPct = 0;
      otmPct = currentPrice > 0 ? ((strike - currentPrice) / currentPrice) * 100 : 0;
    }
  } else {
    // PUT: ITM when stock < strike
    isItm = currentPrice < strike;
    if (isItm) {
      intrinsicValue = strike - currentPrice;
      itmPct = (intrinsicValue / strike) * 100;
      otmPct = 0;
    } else {
      intrinsicValue = 0;
      itmPct = 0;
      otmPct = currentPrice > 0 ? ((currentPrice - strike) / currentPrice) * 100 : 0;
    }
  }

  // Distance from strike (absolute)
  const distanceToStrikePct = strike > 0 ? (Math.abs(currentPrice - strike) / strike) * 100 : 0;

  return {
    isItm,
    itmPct: Math.round(itmPct * 100) / 100,
    otmPct: Math.round(otmPct * 100) / 100,
    intrinsicValue: Math.round(intrinsicValue * 100) / 100,
    distanceToStrikePct: Math.round(distanceToStrikePct * 100) / 100,
  };
}

// =============================================================================
// V3: COST VALIDATION (Modified for OptionPundit)
// =============================================================================

export interface CostValidation {
  acceptable: boolean;
  reason: string;
  maxDebit: number;
  netCost: number;
  isCredit: boolean;
  searchLonger?: boolean;
}

/**
 * Check if roll cost is acceptable.
 *
 * OPTIONPUNDIT MODIFICATION:
 * Uses 20% of NEW premium (not original premium) since we don't have original.
 *
 * Rule: Debit must be ≤ 20% of new premium collected.
 * Any credit is automatically acceptable.
 *
 * @param netCost - Net cost of roll (positive = debit, negative = credit)
 * @param newPremium - New premium being collected
 * @returns Cost validation result
 */
export function isAcceptableCost(netCost: number, newPremium: number): CostValidation {
  const maxDebit = newPremium * MAX_DEBIT_PCT;

  // Any credit is automatically acceptable
  if (netCost <= 0) {
    return {
      acceptable: true,
      reason: `Credit of $${Math.abs(netCost).toFixed(2)} - always acceptable`,
      maxDebit: Math.round(maxDebit * 100) / 100,
      netCost: Math.round(netCost * 100) / 100,
      isCredit: true,
    };
  }

  // Check if debit is within 20% threshold
  if (netCost <= maxDebit) {
    return {
      acceptable: true,
      reason: `Debit $${netCost.toFixed(2)} ≤ max $${maxDebit.toFixed(2)} (20% of $${newPremium.toFixed(2)})`,
      maxDebit: Math.round(maxDebit * 100) / 100,
      netCost: Math.round(netCost * 100) / 100,
      isCredit: false,
    };
  }

  // Debit exceeds 20% threshold
  return {
    acceptable: false,
    reason: `Debit $${netCost.toFixed(2)} > max $${maxDebit.toFixed(2)} (20% of $${newPremium.toFixed(2)})`,
    maxDebit: Math.round(maxDebit * 100) / 100,
    netCost: Math.round(netCost * 100) / 100,
    isCredit: false,
    searchLonger: true, // Hint to try longer expirations
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a new position at new_strike would be ITM.
 *
 * @param currentPrice - Current stock price
 * @param newStrike - Proposed new strike price
 * @param optionType - 'call' or 'put'
 * @returns True if new position would be ITM
 */
export function wouldBeItm(
  currentPrice: number,
  newStrike: number,
  optionType: 'call' | 'put'
): boolean {
  const optionTypeLower = optionType.toLowerCase();

  if (optionTypeLower === 'call') {
    return currentPrice > newStrike;
  } else {
    return currentPrice < newStrike;
  }
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Get the next Friday from a date
 */
export function getNextFriday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return date;
}

/**
 * Get the Friday after a given date (next Friday)
 */
export function getFridayAfter(referenceDate: Date): Date {
  const date = new Date(referenceDate);
  const dayOfWeek = date.getDay();
  let daysAhead = 5 - dayOfWeek; // Friday = 5
  if (daysAhead <= 0) {
    daysAhead += 7;
  }
  date.setDate(date.getDate() + daysAhead);
  return date;
}

/**
 * Parse date string to Date object
 */
export function parseDate(dateStr: string): Date {
  // Handle YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date as MMM DD (e.g., "Jan 19")
 */
export function formatDateMedium(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate profit percentage
 */
export function calculateProfitPercent(originalPremium: number, currentPremium: number): number {
  if (originalPremium <= 0) return 0;
  return (originalPremium - currentPremium) / originalPremium;
}

/**
 * Calculate net cost/credit for a roll
 * Negative = credit (receive money)
 * Positive = debit (pay money)
 */
export function calculateRollNetCost(buyBackCost: number, newPremium: number): number {
  return buyBackCost - newPremium;
}

/**
 * Format net cost as string with credit/debit label
 */
export function formatNetCost(netCost: number): string {
  if (netCost < 0) {
    return `$${Math.abs(netCost).toFixed(2)} credit`;
  }
  return `$${netCost.toFixed(2)} debit`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// =============================================================================
// PREMIUM ESTIMATION
// =============================================================================

/**
 * Estimate option premium based on strike distance and time to expiration.
 *
 * This is a simplified model used when real market data isn't available.
 * Uses volatility-based estimation.
 *
 * @param currentPrice - Current stock price
 * @param strike - Strike price
 * @param daysToExpiration - Days until expiration
 * @param weeklyVolatility - Weekly volatility (default 3%)
 * @param optionType - 'call' or 'put'
 * @returns Estimated premium per share
 */
export function estimatePremium(
  currentPrice: number,
  strike: number,
  daysToExpiration: number,
  weeklyVolatility: number = DEFAULT_CONFIG_V3.defaultWeeklyVolatility,
  optionType: 'call' | 'put'
): number {
  // Calculate weeks to expiration
  const weeks = Math.max(daysToExpiration / 7, 0.1);

  // Calculate OTM percentage
  let otmPct: number;
  if (optionType === 'call') {
    otmPct = Math.max(0, (strike - currentPrice) / currentPrice);
  } else {
    otmPct = Math.max(0, (currentPrice - strike) / currentPrice);
  }

  // Base premium from time value (simplified Black-Scholes approximation)
  const basePremium = currentPrice * weeklyVolatility * Math.sqrt(weeks) * 0.5;

  // Reduce premium for further OTM strikes
  const otmFactor = Math.max(0.1, 1 - otmPct * 5);

  return Math.round(basePremium * otmFactor * 100) / 100;
}

/**
 * Estimate delta based on strike distance and time.
 *
 * Simplified delta estimation when real Greeks aren't available.
 * Uses normal distribution approximation.
 *
 * @param currentPrice - Current stock price
 * @param strike - Strike price
 * @param daysToExpiration - Days until expiration
 * @param weeklyVolatility - Weekly volatility
 * @param optionType - 'call' or 'put'
 * @returns Estimated delta (0 to 1)
 */
export function estimateDelta(
  currentPrice: number,
  strike: number,
  daysToExpiration: number,
  weeklyVolatility: number = DEFAULT_CONFIG_V3.defaultWeeklyVolatility,
  optionType: 'call' | 'put'
): number {
  const weeks = Math.max(daysToExpiration / 7, 0.1);
  const adjustedVolatility = weeklyVolatility * Math.sqrt(weeks);

  // Calculate distance in standard deviations
  let zScore: number;
  if (optionType === 'call') {
    zScore = (strike - currentPrice) / (currentPrice * adjustedVolatility);
  } else {
    zScore = (currentPrice - strike) / (currentPrice * adjustedVolatility);
  }

  // Approximate cumulative normal distribution
  // For OTM options, higher z-score = lower delta
  const delta = 0.5 * (1 - Math.tanh(zScore * 0.7));

  return Math.min(0.99, Math.max(0.01, delta));
}

/**
 * Estimate probability of staying OTM based on distance and volatility.
 *
 * @param distancePercent - OTM distance as percentage
 * @param weeklyVolatility - Weekly volatility
 * @param weeks - Weeks to expiration
 * @returns Probability of staying OTM (0 to 100)
 */
export function estimateProbabilityOtm(
  distancePercent: number,
  weeklyVolatility: number,
  weeks: number
): number {
  const adjustedVolatility = weeklyVolatility * Math.sqrt(weeks);
  const zScore = (distancePercent / 100) / adjustedVolatility;

  // Approximate cumulative normal distribution
  const prob = 0.5 * (1 + Math.tanh(zScore * 0.7));

  return Math.min(99, Math.max(1, prob * 100));
}

/**
 * Find Delta 10 or Delta 30 strike price.
 *
 * Delta 10 = 90% probability OTM (conservative, for weekly rolls)
 * Delta 30 = 70% probability OTM (closer, for ITM escapes)
 *
 * @param currentPrice - Current stock price
 * @param optionType - 'call' or 'put'
 * @param deltaTarget - Target delta (0.10 or 0.30)
 * @param weeklyVolatility - Weekly volatility
 * @param weeks - Weeks to expiration
 * @returns Recommended strike price
 */
export function findDeltaStrike(
  currentPrice: number,
  optionType: 'call' | 'put',
  deltaTarget: number,
  weeklyVolatility: number = DEFAULT_CONFIG_V3.defaultWeeklyVolatility,
  weeks: number = 1
): number {
  // Convert delta target to z-score
  // Delta 10 (90% OTM) = ~1.65 standard deviations
  // Delta 30 (70% OTM) = ~0.52 standard deviations
  const probOtm = 1 - deltaTarget; // 0.90 for Delta 10, 0.70 for Delta 30

  // Inverse of tanh approximation for normal CDF
  const zScore = Math.atanh(2 * probOtm - 1) / 0.7;

  const adjustedVolatility = weeklyVolatility * Math.sqrt(weeks);
  const distance = currentPrice * adjustedVolatility * zScore;

  let strike: number;
  if (optionType === 'call') {
    strike = currentPrice + distance;
  } else {
    strike = currentPrice - distance;
  }

  // Round to nearest $0.50 or $1 depending on price
  if (currentPrice < 50) {
    return Math.round(strike * 2) / 2; // Round to $0.50
  } else if (currentPrice < 200) {
    return Math.round(strike); // Round to $1
  } else {
    return Math.round(strike / 5) * 5; // Round to $5
  }
}

