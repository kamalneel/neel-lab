/**
 * Algorithm Module - V3.3 Position Evaluation
 *
 * This module exports all V3.3 algorithm components for option position evaluation.
 *
 * @sync_source agrawal-estate/backend/app/modules/strategies/
 * @source_version V3.3
 * @sync_date 2026-01-17
 *
 * V3.3 Changes:
 * - Added COMPRESS action for far-dated ITM positions
 * - Added MONITOR action for TA-based mean reversion waiting
 * - Split ITM handling: near (≤60 days) = ESCAPE, far (>60 days) = COMPRESS
 * - minWeeksForPullback: 2 → 1
 */

// Types
export * from './types';

// Configuration
export { DEFAULT_CONFIG_V3, ROLL_DURATION_WEEKS, getFridayNWeeksOut } from './config';
export type { AlgorithmConfigV3 } from './config';

// Core calculations
export {
  calculateItmStatus,
  isAcceptableCost,
  wouldBeItm,
  daysBetween,
  getNextFriday,
  getFridayAfter,
  parseDate,
  formatDateISO,
  formatDateMedium,
  calculateProfitPercent,
  calculateRollNetCost,
  formatNetCost,
  formatCurrency,
  formatPercent,
  estimatePremium,
  estimateDelta,
  estimateProbabilityOtm,
  findDeltaStrike,
} from './calculations';

// Zero-cost finder
export { findZeroCostRoll, findZeroCostRollAsync } from './zero-cost-finder';
export type { ZeroCostRollResult, ZeroCostFinderOptions } from './zero-cost-finder';

// Pull-back detector
export { checkPullBackOpportunity, checkPullBackOpportunityAsync } from './pull-back-detector';
export type { PullBackResult, PullBackOptions } from './pull-back-detector';

// Position evaluator (main entry point)
export {
  evaluatePosition,
  evaluateStockForCoveredCall,
  evaluatePositions,
} from './position-evaluator';
export type { EvaluationContext } from './position-evaluator';



