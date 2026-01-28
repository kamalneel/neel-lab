/**
 * Unified Position Evaluator for V3.3 Algorithm
 *
 * @ported_from agrawal-estate/backend/app/modules/strategies/position_evaluator.py
 * @source_version V3.3
 * @sync_date 2026-01-17
 *
 * Modifications:
 * - Removed IRA smart assignment logic
 * - Removed database dependencies
 * - Uses NEW premium for cost validation (not original)
 * - Async-ready for market data fetching
 *
 * V3.3 Core Philosophy - Mean Reversion:
 * - ONE recommendation per position per evaluation
 * - Target maintaining ~30-60 day positions for multiple mean reversion cycles
 * - Priority-based decision tree with new COMPRESS and MONITOR actions
 *
 * V3.3 Framework:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  IF ITM:                                                         │
 * │    ├─ Near expiry (≤60 days) → ESCAPE: Roll to OTM urgently     │
 * │    │   (Assignment risk - must get out now)                      │
 * │    │                                                             │
 * │    └─ Far expiry (>60 days) → COMPRESS: Shorten to ~60-90 days  │
 * │        + get OTM (Position for next mean reversion cycle)        │
 * │                                                                  │
 * │  IF OTM:                                                         │
 * │    ├─ Far expiry (>8 weeks) → PULL-BACK: Return to shorter      │
 * │    │   (Position works, but compress to stay nimble)             │
 * │    │                                                             │
 * │    ├─ Near expiry + ≥60% profit → ROLL: Capture and repeat      │
 * │    │                                                             │
 * │    └─ Near expiry + <60% profit → HOLD: Wait for time decay     │
 * │                                                                  │
 * │  NEAR ITM (within 2%):                                           │
 * │    └─ Preemptive warning before assignment risk                  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * V3.3 Actions:
 * 1. PULL_BACK: Far-dated OTM → shorter expiration (stay nimble)
 * 2. ROLL_ITM: Near-dated ITM → escape to OTM (avoid assignment)
 * 3. COMPRESS: Far-dated ITM → shorter + OTM (catch mean reversion)
 * 4. MONITOR: Far-dated ITM, no compress found (wait for opportunity)
 * 5. NEAR_ITM_WARNING: Within 2% of strike (preemptive alert)
 * 6. ROLL_WEEKLY: Profitable OTM → next week (capture profits)
 * 7. CLOSE_CATASTROPHIC: Cannot escape ITM (limit loss)
 */

import {
  EvaluationResult,
  Priority,
  PositionForEvaluation,
  StockHolding,
  StockQuote,
  EarningsInfo,
  DividendInfo,
} from './types';
import { DEFAULT_CONFIG_V3, AlgorithmConfigV3, getFridayNWeeksOut, ROLL_DURATION_WEEKS } from './config';
import {
  calculateItmStatus,
  daysBetween,
  estimatePremium,
  findDeltaStrike,
  formatDateISO,
  parseDate,
} from './calculations';
import { findZeroCostRoll } from './zero-cost-finder';
import { checkPullBackOpportunity, PullBackResult } from './pull-back-detector';

/**
 * Context for position evaluation
 */
export interface EvaluationContext {
  /** Current stock price (fetched or provided) */
  currentPrice: number;

  /** Weekly volatility */
  weeklyVolatility?: number;

  /** Earnings info */
  earningsInfo?: EarningsInfo;

  /** Dividend info */
  dividendInfo?: DividendInfo;

  /** Algorithm configuration */
  config?: AlgorithmConfigV3;
}

/**
 * Generate unique position identifier
 */
function getPositionId(position: PositionForEvaluation): string {
  return `${position.symbol}_${position.strike}_${position.expiration}`;
}

/**
 * Main evaluation logic - returns ONE recommendation per position.
 *
 * Priority order (first match wins):
 * 1. Pull-back opportunity (far-dated → shorter)
 * 2. ITM escape (find zero-cost roll)
 * 3. Near-ITM warning (close to strike)
 * 4. Profitable weekly roll (60%+ profit)
 * 5. No action
 *
 * @param position - Position to evaluate
 * @param context - Evaluation context with market data
 * @returns EvaluationResult, or null if no action needed
 */
export function evaluatePosition(
  position: PositionForEvaluation,
  context: EvaluationContext
): EvaluationResult | null {
  const config = context.config ?? DEFAULT_CONFIG_V3;
  const { currentPrice, weeklyVolatility = config.defaultWeeklyVolatility } = context;

  const positionId = getPositionId(position);
  const expirationDate = parseDate(position.expiration);
  const today = new Date();

  // Calculate days and weeks to expiration
  const daysToExp = daysBetween(today, expirationDate);
  const weeksToExp = Math.max(1, Math.floor(daysToExp / 7));

  // Skip expired positions
  if (daysToExp < 0) {
    return null;
  }

  // Calculate ITM status
  const itmStatus = calculateItmStatus(currentPrice, position.strike, position.optionType);

  // Estimate current premium if not provided
  const currentPremium =
    position.currentPremium ??
    estimatePremium(currentPrice, position.strike, daysToExp, weeklyVolatility, position.optionType);

  // Estimate profit percentage (using current premium as proxy)
  // Since we don't have original premium, we estimate based on time decay
  const estimatedOriginalPremium = position.premium ?? currentPremium * 1.5; // Rough estimate
  const profitPct =
    estimatedOriginalPremium > 0
      ? (estimatedOriginalPremium - currentPremium) / estimatedOriginalPremium
      : 0;

  // ================================================================
  // STATE 1: Pull-back opportunity (highest priority)
  // If far-dated and can return to shorter duration, do it
  // ================================================================
  if (weeksToExp > config.minWeeksForPullback) {
    const pullBack = checkPullBackOpportunity({
      symbol: position.symbol,
      currentExpiration: expirationDate,
      currentStrike: position.strike,
      optionType: position.optionType,
      currentPremium,
      currentPrice,
      contracts: position.contracts,
      weeklyVolatility,
      earningsInfo: context.earningsInfo,
      dividendInfo: context.dividendInfo,
    });

    if (pullBack) {
      return generatePullBackResult(position, positionId, pullBack);
    }
  }

  // ================================================================
  // STATE 1.5: Weekly Income Compress (V3.3)
  // For SLIGHTLY ITM + PROFITABLE positions, prefer COMPRESS to preserve income cycle
  //
  // Example: AVGO $350 Put Jan 23, Stock $346 (1.1% ITM), 79% profit
  //   → Don't extend to Jan 30 (loses weekly cycle)
  //   → COMPRESS to Jan 16 at $355 (preserves weekly cycle)
  // ================================================================
  if (
    itmStatus.isItm &&
    itmStatus.itmPct <= config.weeklyIncomeMaxItmPct &&
    profitPct >= config.weeklyIncomeMinProfitPct
  ) {
    const weeklyCompress = handleWeeklyIncomeCompress(
      position,
      positionId,
      context,
      itmStatus,
      currentPremium,
      daysToExp,
      profitPct
    );
    if (weeklyCompress) {
      return weeklyCompress;
    }
    // If no weekly income compress found, fall through to normal ITM handling
  }

  // ================================================================
  // STATE 2: In the money (V3.3 split handling)
  //
  // Near expiry (≤60 days): ESCAPE - urgent roll to OTM
  // Far expiry (>60 days): COMPRESS - shorten to ~60-90 days + get OTM
  // ================================================================
  if (itmStatus.isItm) {
    if (daysToExp > config.itmCompressThresholdDays) {
      // Far-dated ITM: Try to COMPRESS time while getting OTM
      const compressResult = handleItmCompress(
        position,
        positionId,
        context,
        itmStatus,
        currentPremium,
        daysToExp
      );
      if (compressResult) {
        return compressResult;
      }

      // No compress found - return MONITOR recommendation
      return {
        action: 'MONITOR',
        positionId,
        symbol: position.symbol,
        priority: 'low',
        reason:
          `${itmStatus.itmPct.toFixed(1)}% ITM, ${daysToExp} days to expiry. ` +
          `No cost-neutral compress found. Monitoring for pullback.`,
        details: {
          itmPct: itmStatus.itmPct,
          daysToExp,
          currentPrice: context.currentPrice,
          strike: position.strike,
          strategy: 'monitor_for_compress',
        },
      };
    }

    // Near-dated ITM (≤60 days): ESCAPE NOW
    return handleItmPosition(position, positionId, context, itmStatus, currentPremium);
  }

  // ================================================================
  // STATE 2.5: Near ITM - approaching strike (preemptive alert)
  // Alert when position is within 2% of strike to avoid assignment
  // ================================================================
  if (
    !itmStatus.isItm &&
    itmStatus.otmPct <= config.nearItmThresholdPct &&
    daysToExp <= config.nearItmMaxDaysToExpiry
  ) {
    return handleNearItmPosition(
      position,
      positionId,
      context,
      itmStatus,
      daysToExp,
      config
    );
  }

  // ================================================================
  // STATE 3: OTM and profitable (standard weekly roll)
  // Roll at 60% profit capture
  // ================================================================
  if (profitPct >= config.profitThreshold && !itmStatus.isItm) {
    return handleProfitablePosition(position, positionId, context, profitPct, config);
  }

  // ================================================================
  // STATE 4: No action needed
  // ================================================================
  return null;
}

/**
 * Handle ITM position - find shortest zero-cost roll
 */
function handleItmPosition(
  position: PositionForEvaluation,
  positionId: string,
  context: EvaluationContext,
  itmStatus: ReturnType<typeof calculateItmStatus>,
  currentPremium: number
): EvaluationResult {
  const config = context.config ?? DEFAULT_CONFIG_V3;

  // Use Delta 30 for ITM rolls (per V3 Addendum)
  const zeroCostRoll = findZeroCostRoll({
    symbol: position.symbol,
    currentStrike: position.strike,
    optionType: position.optionType,
    currentExpiration: parseDate(position.expiration),
    currentPrice: context.currentPrice,
    buyBackCost: currentPremium,
    contracts: position.contracts,
    maxMonths: config.maxRollMonths,
    deltaTarget: config.deltaTargetItm,
    weeklyVolatility: context.weeklyVolatility,
    earningsInfo: context.earningsInfo,
    dividendInfo: context.dividendInfo,
  });

  if (zeroCostRoll) {
    // Found escape route
    const priority: Priority = itmStatus.itmPct >= 10 ? 'urgent' : itmStatus.itmPct >= 5 ? 'high' : 'medium';

    return {
      action: 'ROLL_ITM',
      positionId,
      symbol: position.symbol,
      priority,
      reason:
        `${itmStatus.itmPct.toFixed(1)}% ITM - rolling to ${zeroCostRoll.weeksOut} weeks ` +
        `at $${zeroCostRoll.strike.toFixed(2)} strike`,
      details: {
        itmPct: itmStatus.itmPct,
        currentPrice: context.currentPrice,
        currentPremium,
        intrinsicValue: itmStatus.intrinsicValue,
      },
      newStrike: zeroCostRoll.strike,
      newExpiration: zeroCostRoll.expirationDate,
      netCost: zeroCostRoll.netCost,
      zeroCostData: {
        weeksOut: zeroCostRoll.weeksOut,
        expirationDate: zeroCostRoll.expirationDate,
        strike: zeroCostRoll.strike,
        newPremium: zeroCostRoll.newPremium,
        netCost: zeroCostRoll.netCost,
        probabilityOtm: zeroCostRoll.probabilityOtm,
        isCredit: zeroCostRoll.isCredit,
      },
    };
  } else {
    // CATASTROPHIC: Cannot escape within 12 months
    return {
      action: 'CLOSE_CATASTROPHIC',
      positionId,
      symbol: position.symbol,
      priority: 'urgent',
      reason:
        `Cannot find zero-cost roll within 12 months. ` +
        `Position ${itmStatus.itmPct.toFixed(1)}% ITM. Consider closing to cut losses.`,
      details: {
        itmPct: itmStatus.itmPct,
        currentPrice: context.currentPrice,
        intrinsicValue: itmStatus.intrinsicValue,
        maxMonthsSearched: config.maxRollMonths,
      },
    };
  }
}

/**
 * Handle near-ITM position - alert about assignment risk
 */
function handleNearItmPosition(
  position: PositionForEvaluation,
  positionId: string,
  context: EvaluationContext,
  itmStatus: ReturnType<typeof calculateItmStatus>,
  daysToExp: number,
  config: AlgorithmConfigV3
): EvaluationResult {
  const isUrgent = itmStatus.otmPct <= config.urgentNearItmThresholdPct;
  const priority: Priority = isUrgent ? 'high' : 'medium';

  const distance = Math.abs(position.strike - context.currentPrice);
  const reasonPrefix = isUrgent ? '⚠️ URGENT: ' : '⚠️ WARNING: ';

  // Suggest rolling to 2 weeks out at safer strike
  const newStrike = findDeltaStrike(
    context.currentPrice,
    position.optionType,
    0.15, // Delta 15 - safer than weekly
    context.weeklyVolatility ?? config.defaultWeeklyVolatility,
    2
  );

  const newExpiration = getFridayNWeeksOut(new Date(), 2);

  return {
    action: 'NEAR_ITM_WARNING',
    positionId,
    symbol: position.symbol,
    priority,
    reason:
      `${reasonPrefix}Position only ${itmStatus.otmPct.toFixed(1)}% OTM ($${distance.toFixed(2)} from strike). ` +
      `Expires in ${daysToExp} days. Consider rolling to avoid assignment risk.`,
    details: {
      otmPct: itmStatus.otmPct,
      distanceToStrike: distance,
      currentPrice: context.currentPrice,
      strikePrice: position.strike,
      daysToExpiry: daysToExp,
      riskLevel: isUrgent ? 'urgent' : 'elevated',
    },
    newStrike,
    newExpiration,
  };
}

/**
 * Handle profitable position - roll to next week
 */
function handleProfitablePosition(
  position: PositionForEvaluation,
  positionId: string,
  context: EvaluationContext,
  profitPct: number,
  config: AlgorithmConfigV3
): EvaluationResult {
  const weeklyVolatility = context.weeklyVolatility ?? config.defaultWeeklyVolatility;

  // Use Delta 10 for weekly rolls
  const newStrike = findDeltaStrike(
    context.currentPrice,
    position.optionType,
    0.10, // Delta 10
    weeklyVolatility,
    1
  );

  // Get next Friday
  const newExpiration = getFridayNWeeksOut(new Date(), 1);

  return {
    action: 'ROLL_WEEKLY',
    positionId,
    symbol: position.symbol,
    priority: 'medium',
    reason: `${(profitPct * 100).toFixed(0)}% profit captured - roll to next week`,
    details: {
      profitPct,
      currentPrice: context.currentPrice,
    },
    newStrike,
    newExpiration,
  };
}

/**
 * V3.3: Handle Weekly Income Compress for slightly ITM + profitable positions.
 *
 * Goal: COMPRESS to shorter duration to preserve weekly income cycle.
 * Accept staying ITM or moving to higher strike (closer to ATM).
 *
 * Example: AVGO $350 Put Jan 23, Stock $346 (1.1% ITM), 79% profit
 *   → COMPRESS to Jan 16 at $355 (preserves weekly cycle, earns credit)
 */
function handleWeeklyIncomeCompress(
  position: PositionForEvaluation,
  positionId: string,
  context: EvaluationContext,
  itmStatus: ReturnType<typeof calculateItmStatus>,
  currentPremium: number,
  daysToExp: number,
  profitPct: number
): EvaluationResult | null {
  const config = context.config ?? DEFAULT_CONFIG_V3;
  const weeklyVolatility = context.weeklyVolatility ?? config.defaultWeeklyVolatility;
  const MAX_DEBIT_FOR_WEEKLY_COMPRESS = 1.0; // Very tight - prioritize credits

  // Look for SHORTER expirations that allow cost-neutral or credit compress
  const today = new Date();

  // Search for compress opportunities from 1 week to current-1 week
  for (const weeks of ROLL_DURATION_WEEKS) {
    const expDays = weeks * 7;

    // Only consider SHORTER expirations
    if (expDays >= daysToExp) continue;
    if (expDays < 2) continue; // Don't compress to expiring tomorrow

    const expiration = getFridayNWeeksOut(today, weeks);

    // Find same strike or closer to ATM
    let newStrike = position.strike;
    if (position.optionType === 'put') {
      // For puts: try lower strike (closer to ATM)
      newStrike = findDeltaStrike(
        context.currentPrice,
        position.optionType,
        0.30,
        weeklyVolatility,
        weeks
      );
      if (newStrike > position.strike) newStrike = position.strike;
    } else {
      // For calls: try higher strike (closer to ATM)
      newStrike = findDeltaStrike(
        context.currentPrice,
        position.optionType,
        0.30,
        weeklyVolatility,
        weeks
      );
      if (newStrike < position.strike) newStrike = position.strike;
    }

    // Estimate new premium
    const newPremium = estimatePremium(
      context.currentPrice,
      newStrike,
      expDays,
      weeklyVolatility,
      position.optionType
    );

    if (newPremium < 0.05) continue;

    // Calculate net cost
    const netCost = currentPremium - newPremium;

    // Accept if credit or small debit
    if (netCost <= MAX_DEBIT_FOR_WEEKLY_COMPRESS) {
      const daysSaved = daysToExp - expDays;
      const isCredit = netCost < 0;
      const costStr = `$${Math.abs(netCost).toFixed(2)} ${isCredit ? 'credit' : 'debit'}`;

      return {
        action: 'COMPRESS',
        positionId,
        symbol: position.symbol,
        priority: 'medium',
        reason:
          `${(profitPct * 100).toFixed(0)}% profit captured, ${itmStatus.itmPct.toFixed(1)}% ITM. ` +
          `Compress to $${newStrike.toFixed(0)} @ ${formatDateISO(expiration)} for ${costStr}. ` +
          `Preserves weekly income cycle.`,
        details: {
          itmPct: itmStatus.itmPct,
          profitPct,
          currentDaysToExp: daysToExp,
          newDaysToExp: expDays,
          daysSaved,
          currentPrice: context.currentPrice,
          currentPremium,
          strategy: 'weekly_income_compress',
        },
        newStrike,
        newExpiration: expiration,
        netCost,
        zeroCostData: {
          weeksOut: weeks,
          expirationDate: expiration,
          strike: newStrike,
          newPremium,
          netCost,
          probabilityOtm: 50, // Approximate for ITM
          isCredit,
        },
      };
    }
  }

  return null; // No weekly income compress found
}

/**
 * V3.3: Handle ITM Compress for far-dated ITM positions (>60 days).
 *
 * Goal: Shorten time to ~60-90 days to catch mean reversion cycle.
 * Two approaches:
 * 1. Same-strike compress: Roll to shorter expiration at SAME strike (cost-neutral)
 * 2. OTM escape compress: Roll to shorter AND get OTM (accept small debit)
 */
function handleItmCompress(
  position: PositionForEvaluation,
  positionId: string,
  context: EvaluationContext,
  itmStatus: ReturnType<typeof calculateItmStatus>,
  currentPremium: number,
  daysToExp: number
): EvaluationResult | null {
  const config = context.config ?? DEFAULT_CONFIG_V3;
  const weeklyVolatility = context.weeklyVolatility ?? config.defaultWeeklyVolatility;

  // Cost tolerance based on ITM severity
  const SAME_STRIKE_MAX_DEBIT = 1.0;
  let otmEscapeMaxDebit: number;
  if (itmStatus.itmPct >= 10) {
    otmEscapeMaxDebit = 5.0;
  } else if (itmStatus.itmPct >= 5) {
    otmEscapeMaxDebit = 3.0;
  } else {
    otmEscapeMaxDebit = 2.0;
  }

  const today = new Date();
  let bestCompress: {
    expiration: Date;
    expDays: number;
    newStrike: number;
    newPremium: number;
    netCost: number;
    isCredit: boolean;
    compressType: 'same_strike' | 'otm_escape';
    daysSaved: number;
    weeksOut: number;
  } | null = null;

  // Search for compress opportunity in target window (45-90 days)
  for (const weeks of ROLL_DURATION_WEEKS) {
    const expDays = weeks * 7;

    // Only consider expirations in target window AND shorter than current
    if (expDays < config.compressTargetMinDays || expDays > config.compressTargetMaxDays) continue;
    if (expDays >= daysToExp) continue;

    const expiration = getFridayNWeeksOut(today, weeks);

    // Approach 1: Same-strike compress (cost-neutral)
    const sameStrikePremium = estimatePremium(
      context.currentPrice,
      position.strike,
      expDays,
      weeklyVolatility,
      position.optionType
    );

    if (sameStrikePremium > 0) {
      const netCost = currentPremium - sameStrikePremium;
      if (netCost <= SAME_STRIKE_MAX_DEBIT) {
        if (!bestCompress || expDays < bestCompress.expDays) {
          bestCompress = {
            expiration,
            expDays,
            newStrike: position.strike,
            newPremium: sameStrikePremium,
            netCost,
            isCredit: netCost < 0,
            compressType: 'same_strike',
            daysSaved: daysToExp - expDays,
            weeksOut: weeks,
          };
        }
      }
    }

    // Approach 2: OTM escape compress
    const otmStrike = findDeltaStrike(
      context.currentPrice,
      position.optionType,
      0.30,
      weeklyVolatility,
      weeks
    );

    // Check if OTM
    const wouldBeOtm =
      position.optionType === 'call'
        ? otmStrike > context.currentPrice
        : otmStrike < context.currentPrice;

    if (wouldBeOtm) {
      const otmPremium = estimatePremium(
        context.currentPrice,
        otmStrike,
        expDays,
        weeklyVolatility,
        position.optionType
      );

      if (otmPremium > 0) {
        const netCost = currentPremium - otmPremium;
        if (netCost <= otmEscapeMaxDebit) {
          // Prefer same-strike if we already have one
          if (!bestCompress || (bestCompress.compressType !== 'same_strike' && expDays < bestCompress.expDays)) {
            bestCompress = {
              expiration,
              expDays,
              newStrike: otmStrike,
              newPremium: otmPremium,
              netCost,
              isCredit: netCost < 0,
              compressType: 'otm_escape',
              daysSaved: daysToExp - expDays,
              weeksOut: weeks,
            };
          }
        }
      }
    }
  }

  if (bestCompress) {
    const costStr = `$${Math.abs(bestCompress.netCost).toFixed(2)} ${bestCompress.isCredit ? 'credit' : 'debit'}`;
    const typeDesc = bestCompress.compressType === 'same_strike' ? 'same strike' : 'OTM escape';

    let reason: string;
    if (bestCompress.compressType === 'same_strike') {
      reason =
        `${itmStatus.itmPct.toFixed(1)}% ITM with ${daysToExp} days left. ` +
        `Compress to ${formatDateISO(bestCompress.expiration)} (same $${bestCompress.newStrike.toFixed(0)} strike) ` +
        `for ${costStr}. Saves ${bestCompress.daysSaved} days to catch mean reversion.`;
    } else {
      reason =
        `${itmStatus.itmPct.toFixed(1)}% ITM with ${daysToExp} days left. ` +
        `Compress + escape to $${bestCompress.newStrike.toFixed(0)} @ ${formatDateISO(bestCompress.expiration)} ` +
        `(${bestCompress.weeksOut}wk) for ${costStr}. ` +
        `Saves ${bestCompress.daysSaved} days AND gets OTM.`;
    }

    return {
      action: 'COMPRESS',
      positionId,
      symbol: position.symbol,
      priority: 'medium',
      reason,
      details: {
        itmPct: itmStatus.itmPct,
        currentDaysToExp: daysToExp,
        newDaysToExp: bestCompress.expDays,
        daysSaved: bestCompress.daysSaved,
        currentPrice: context.currentPrice,
        currentPremium,
        strategy: `compress_${typeDesc.replace(' ', '_')}`,
      },
      newStrike: bestCompress.newStrike,
      newExpiration: bestCompress.expiration,
      netCost: bestCompress.netCost,
      zeroCostData: {
        weeksOut: bestCompress.weeksOut,
        expirationDate: bestCompress.expiration,
        strike: bestCompress.newStrike,
        newPremium: bestCompress.newPremium,
        netCost: bestCompress.netCost,
        probabilityOtm: bestCompress.compressType === 'otm_escape' ? 70 : 30,
        isCredit: bestCompress.isCredit,
      },
    };
  }

  return null; // No compress opportunity found
}

/**
 * Generate pull-back recommendation
 */
function generatePullBackResult(
  position: PositionForEvaluation,
  positionId: string,
  pullBack: PullBackResult
): EvaluationResult {
  return {
    action: 'PULL_BACK',
    positionId,
    symbol: position.symbol,
    priority: 'high',
    reason:
      `Can pull back from ${pullBack.fromWeeks} weeks to ${pullBack.toWeeks} weeks. ` +
      `${pullBack.benefit}`,
    details: {
      weeksSaved: pullBack.weeksSaved,
      currentValue: pullBack.currentValue,
    },
    newStrike: pullBack.newStrike,
    newExpiration: pullBack.toExpiration,
    netCost: pullBack.netCost,
    pullBackData: {
      fromWeeks: pullBack.fromWeeks,
      toWeeks: pullBack.toWeeks,
      fromExpiration: pullBack.fromExpiration,
      toExpiration: pullBack.toExpiration,
      newStrike: pullBack.newStrike,
      newPremium: pullBack.newPremium,
      currentValue: pullBack.currentValue,
      netCost: pullBack.netCost,
      weeksSaved: pullBack.weeksSaved,
      benefit: pullBack.benefit,
    },
  };
}

/**
 * Evaluate stock holding for new covered call recommendation
 */
export function evaluateStockForCoveredCall(
  holding: StockHolding,
  context: EvaluationContext
): EvaluationResult | null {
  const config = context.config ?? DEFAULT_CONFIG_V3;
  const { currentPrice, weeklyVolatility = config.defaultWeeklyVolatility } = context;

  // Must have at least 100 shares
  const contractsPossible = Math.floor(holding.shares / 100);
  if (contractsPossible < 1) {
    return null;
  }

  // Find Delta 10 strike for weekly
  const strike = findDeltaStrike(currentPrice, 'call', 0.10, weeklyVolatility, 1);

  // Estimate premium
  const nextFriday = getFridayNWeeksOut(new Date(), 1);
  const daysToExp = daysBetween(new Date(), nextFriday);
  const premium = estimatePremium(currentPrice, strike, daysToExp, weeklyVolatility, 'call');

  // Calculate potential income
  const weeklyIncome = premium * contractsPossible * 100;
  const yearlyIncome = weeklyIncome * 50; // ~50 weeks per year

  const positionId = `new_${holding.symbol}_${formatDateISO(new Date())}`;

  return {
    action: 'SELL_NEW',
    positionId,
    symbol: holding.symbol,
    priority: yearlyIncome >= 5000 ? 'high' : 'medium',
    reason:
      `Sell ${contractsPossible} covered call(s) at $${strike} strike. ` +
      `Est. $${weeklyIncome.toFixed(0)}/week, $${yearlyIncome.toFixed(0)}/year`,
    details: {
      shares: holding.shares,
      contractsPossible,
      estimatedPremium: premium,
      weeklyIncome,
      yearlyIncome,
    },
    newStrike: strike,
    newExpiration: nextFriday,
  };
}

/**
 * Batch evaluate multiple positions
 */
export function evaluatePositions(
  positions: PositionForEvaluation[],
  holdings: StockHolding[],
  quotes: Map<string, StockQuote>,
  earningsMap?: Map<string, EarningsInfo>,
  dividendsMap?: Map<string, DividendInfo>,
  config?: AlgorithmConfigV3
): EvaluationResult[] {
  const results: EvaluationResult[] = [];
  const algoConfig = config ?? DEFAULT_CONFIG_V3;

  // Track which symbols have options sold
  const symbolsWithOptions = new Set(positions.map((p) => p.symbol));

  // Evaluate each position
  for (const position of positions) {
    const quote = quotes.get(position.symbol);
    if (!quote) {
      console.warn(`No quote for ${position.symbol}, skipping`);
      continue;
    }

    const context: EvaluationContext = {
      currentPrice: quote.currentPrice,
      config: algoConfig,
      earningsInfo: earningsMap?.get(position.symbol),
      dividendInfo: dividendsMap?.get(position.symbol),
    };

    const result = evaluatePosition(position, context);
    if (result) {
      results.push(result);
    }
  }

  // Evaluate holdings for new covered calls (only if no option already sold)
  for (const holding of holdings) {
    if (symbolsWithOptions.has(holding.symbol)) {
      continue; // Already has options
    }

    const quote = quotes.get(holding.symbol);
    if (!quote) {
      console.warn(`No quote for ${holding.symbol}, skipping`);
      continue;
    }

    const context: EvaluationContext = {
      currentPrice: quote.currentPrice,
      config: algoConfig,
      earningsInfo: earningsMap?.get(holding.symbol),
      dividendInfo: dividendsMap?.get(holding.symbol),
    };

    const result = evaluateStockForCoveredCall(holding, context);
    if (result) {
      results.push(result);
    }
  }

  // Sort by priority
  const priorityOrder: Record<Priority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  results.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return results;
}

