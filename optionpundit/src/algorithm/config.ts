/**
 * V3.3 Algorithm Configuration
 *
 * @ported_from agrawal-estate/backend/app/modules/strategies/algorithm_config.py
 * @source_version V3.3
 * @sync_date 2026-01-17
 *
 * Modifications:
 * - Removed IRA-specific parameters
 * - Removed database-related config
 * - Cost rule uses NEW premium (not original)
 *
 * V3.3 Changes:
 * - minWeeksForPullback: 2 → 1 (check pullback for >1 week positions)
 * - Added ITM compress thresholds for far-dated positions
 * - Added TA-based MONITOR thresholds for mean reversion
 */

export interface AlgorithmConfigV3 {
  // === VERSION ===

  /** Algorithm version identifier */
  version: string;

  // === CORE THRESHOLDS ===

  /** Roll weekly when this much profit captured (0.60 = 60%) */
  profitThreshold: number;

  /** Maximum acceptable debit as % of NEW premium (0.20 = 20%) */
  maxDebitPct: number;

  /** Never roll beyond this many months - close if can't escape */
  maxRollMonths: number;

  // === STRIKE SELECTION ===

  /** Delta target for weekly rolls (0.90 = Delta 10, 90% OTM probability) */
  deltaTargetWeekly: number;

  /** Delta target for ITM rolls and pull-backs (0.70 = Delta 30) */
  deltaTargetItm: number;

  // === PULL-BACK ===

  /** Minimum weeks to expiration to check pull-back (V3.3: was 2, now 1) */
  minWeeksForPullback: number;

  // === ITM COMPRESS (V3.3) ===

  /** Days to expiry threshold for compress vs escape (>60 = compress) */
  itmCompressThresholdDays: number;

  /** Target minimum days for compress destination */
  compressTargetMinDays: number;

  /** Target maximum days for compress destination */
  compressTargetMaxDays: number;

  /** Max ITM % for weekly income compress to apply */
  weeklyIncomeMaxItmPct: number;

  /** Min profit % for weekly income compress */
  weeklyIncomeMinProfitPct: number;

  // === TA-BASED MONITOR (V3.4) ===

  /** Max ITM % to apply TA-based monitoring */
  taMonitorMaxItmPct: number;

  /** Min days to expiry for TA-based monitoring */
  taMonitorMinDays: number;

  // === NEAR-ITM WARNING ===

  /** Alert when OTM but within this % of strike */
  nearItmThresholdPct: number;

  /** Urgent alert when within this % of strike */
  urgentNearItmThresholdPct: number;

  /** Only alert near-ITM if expiring within this many days */
  nearItmMaxDaysToExpiry: number;

  // === RISK MANAGEMENT ===

  /** Alert if earnings within this many trading days */
  earningsLookbackDays: number;

  /** Alert if ex-dividend within this many days */
  dividendLookbackDays: number;

  // === LIQUIDITY (for warnings) ===

  /** Warn if open interest below this */
  minOpenInterest: number;

  /** Warn if bid-ask spread exceeds this % */
  maxSpreadPct: number;

  // === VOLATILITY DEFAULTS ===

  /** Default weekly volatility if not available from API */
  defaultWeeklyVolatility: number;
}

/**
 * Default V3.3 configuration
 * Matches the values from Agrawal Estate's V3.3 implementation
 *
 * V3.3 Key Changes:
 * - minWeeksForPullback: 2 → 1 (was 2 in V3.0)
 * - Added ITM compress thresholds for far-dated positions
 * - Added TA-based MONITOR thresholds
 */
export const DEFAULT_CONFIG_V3: AlgorithmConfigV3 = {
  // Version
  version: 'v3.3',

  // Core thresholds
  profitThreshold: 0.60, // 60% profit to trigger roll
  maxDebitPct: 0.20, // Max 20% of new premium as debit
  maxRollMonths: 12, // Search up to 12 months for zero-cost roll

  // Strike selection
  deltaTargetWeekly: 0.90, // Delta 10 for weekly rolls
  deltaTargetItm: 0.70, // Delta 30 for ITM escapes

  // Pull-back (V3.3: was 2, now 1)
  minWeeksForPullback: 1, // Check pull-back for positions >1 week out

  // ITM Compress (V3.3)
  itmCompressThresholdDays: 60, // >60 days = try compress instead of escape
  compressTargetMinDays: 45, // Compress target: 45-90 days
  compressTargetMaxDays: 90,
  weeklyIncomeMaxItmPct: 5.0, // Weekly income compress: max 5% ITM
  weeklyIncomeMinProfitPct: 0.60, // Weekly income compress: min 60% profit

  // TA-based Monitor (V3.4)
  taMonitorMaxItmPct: 8.0, // Apply TA monitoring to ≤8% ITM
  taMonitorMinDays: 5, // Need at least 5 days for mean reversion

  // Near-ITM warning
  nearItmThresholdPct: 2.0, // Alert when within 2% of strike
  urgentNearItmThresholdPct: 1.0, // Urgent when within 1%
  nearItmMaxDaysToExpiry: 7, // Only alert if expiring within 7 days

  // Risk management
  earningsLookbackDays: 5, // Alert if earnings within 5 days
  dividendLookbackDays: 7, // Alert if ex-div within 7 days

  // Liquidity
  minOpenInterest: 50, // Warn below 50 contracts
  maxSpreadPct: 10, // Warn if spread > 10%

  // Volatility
  defaultWeeklyVolatility: 0.03, // 3% default weekly volatility
};

/**
 * Duration options for zero-cost roll search (in weeks)
 * Scans progressively longer durations to find acceptable roll
 */
export const ROLL_DURATION_WEEKS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 36, 52];

/**
 * Get Friday N weeks from a date
 */
export function getFridayNWeeksOut(fromDate: Date, weeks: number): Date {
  const date = new Date(fromDate);
  // Move to next Friday if not already Friday
  const dayOfWeek = date.getDay();
  let daysToFriday = (5 - dayOfWeek + 7) % 7;
  if (daysToFriday === 0 && weeks > 0) {
    daysToFriday = 7; // Next Friday if today is Friday
  }
  date.setDate(date.getDate() + daysToFriday + (weeks - 1) * 7);
  return date;
}



