/**
 * V3.3 Algorithm Types
 *
 * @ported_from agrawal-estate/backend/app/modules/strategies/position_evaluator.py
 * @source_version V3.3
 * @sync_date 2026-01-17
 *
 * TypeScript equivalents of Python dataclasses used in the V3 algorithm.
 *
 * V3.3 Changes:
 * - Added COMPRESS action for far-dated ITM positions
 * - Added MONITOR action for TA-based mean reversion waiting
 */

/**
 * Action types from the V3.3 position evaluator
 *
 * V3.0 Actions: PULL_BACK, ROLL_ITM, NEAR_ITM_WARNING, ROLL_WEEKLY, CLOSE_CATASTROPHIC, SELL_NEW
 * V3.3 Additions: COMPRESS, MONITOR
 */
export type EvaluationAction =
  | 'PULL_BACK'
  | 'ROLL_ITM'
  | 'COMPRESS'
  | 'MONITOR'
  | 'NEAR_ITM_WARNING'
  | 'ROLL_WEEKLY'
  | 'CLOSE_CATASTROPHIC'
  | 'SELL_NEW'
  | 'NO_ACTION';

/**
 * Priority levels for recommendations
 */
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'info';

/**
 * Result of position evaluation
 * Matches Python EvaluationResult dataclass
 */
export interface EvaluationResult {
  /** Action type */
  action: EvaluationAction;

  /** Unique position identifier */
  positionId: string;

  /** Stock symbol */
  symbol: string;

  /** Priority level */
  priority: Priority;

  /** Human-readable reason */
  reason: string;

  /** Additional details */
  details: Record<string, unknown>;

  // For roll actions
  /** New strike price for roll */
  newStrike?: number;

  /** New expiration date for roll */
  newExpiration?: Date;

  /** Net cost (negative = credit) */
  netCost?: number;

  // For pull-back
  pullBackData?: PullBackData;

  // For ITM rolls
  zeroCostData?: ZeroCostData;
}

/**
 * Pull-back opportunity data
 */
export interface PullBackData {
  /** Current weeks to expiration */
  fromWeeks: number;

  /** Target weeks to expiration */
  toWeeks: number;

  /** Current expiration date */
  fromExpiration: Date;

  /** New expiration date */
  toExpiration: Date;

  /** New strike price */
  newStrike: number;

  /** New premium estimate */
  newPremium: number;

  /** Current option value */
  currentValue: number;

  /** Net cost of roll */
  netCost: number;

  /** Weeks saved by pulling back */
  weeksSaved: number;

  /** Benefit description */
  benefit: string;
}

/**
 * Zero-cost roll search result
 */
export interface ZeroCostData {
  /** Weeks out for the roll */
  weeksOut: number;

  /** Expiration date */
  expirationDate: Date;

  /** Strike price */
  strike: number;

  /** New premium estimate */
  newPremium: number;

  /** Net cost (should be ≤ max debit) */
  netCost: number;

  /** Estimated probability of staying OTM */
  probabilityOtm: number;

  /** Whether roll results in credit */
  isCredit: boolean;
}

/**
 * ITM calculation result
 */
export interface ItmStatus {
  /** Whether position is in the money */
  isItm: boolean;

  /** ITM percentage (0 if OTM) */
  itmPct: number;

  /** OTM percentage (0 if ITM) */
  otmPct: number;

  /** Intrinsic value per share */
  intrinsicValue: number;

  /** Distance to strike as percentage */
  distanceToStrikePct: number;
}

/**
 * Option quote from market data
 */
export interface OptionQuote {
  strike: number;
  bid: number;
  ask: number;
  last?: number;
  volume?: number;
  openInterest?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  impliedVolatility?: number;
  expirationDate: string;
  inTheMoney?: boolean;
}

/**
 * Options chain data
 */
export interface OptionsChain {
  symbol: string;
  underlyingPrice: number;
  calls: OptionQuote[];
  puts: OptionQuote[];
  expirationDate: string;
}

/**
 * Stock quote from market data
 */
export interface StockQuote {
  symbol: string;
  currentPrice: number;
  bid?: number;
  ask?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  previousClose?: number;
}

/**
 * Earnings info
 */
export interface EarningsInfo {
  symbol: string;
  earningsDate?: Date;
  daysUntilEarnings?: number;
}

/**
 * Dividend info
 */
export interface DividendInfo {
  symbol: string;
  exDividendDate?: Date;
  dividendAmount?: number;
  daysUntilExDiv?: number;
}

/**
 * Position for evaluation
 * This is what users provide (from Robinhood or manual entry)
 */
export interface PositionForEvaluation {
  /** Stock symbol */
  symbol: string;

  /** Option type */
  optionType: 'call' | 'put';

  /** Strike price */
  strike: number;

  /** Expiration date (YYYY-MM-DD) */
  expiration: string;

  /** Number of contracts */
  contracts: number;

  /** Premium received when sold (optional) */
  premium?: number;

  /** Current premium/value (optional - will fetch if not provided) */
  currentPremium?: number;

  /** Current stock price (optional - will fetch if not provided) */
  currentPrice?: number;

  /** Account name (optional) */
  account?: string;
}

/**
 * Stock holding for covered call recommendations
 */
export interface StockHolding {
  /** Stock symbol */
  symbol: string;

  /** Number of shares */
  shares: number;

  /** Average cost per share */
  avgCost?: number;

  /** Current price (optional - will fetch if not provided) */
  currentPrice?: number;
}



