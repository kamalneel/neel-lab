// Stock position (holdings)
export interface Position {
  id: string;
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice?: number;
}

// Sold option contract
export interface SoldOption {
  id: string;
  symbol: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;
  contracts: number;
  premium: number;
  currentPremium?: number;
  account?: string;
}

// Priority levels
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'info';

// ============================================================================
// V3.3 Strategy Types (Ported from Agrawal Estate)
// ============================================================================

/**
 * V3.3 Action types from position evaluator
 *
 * V3.0 Actions: PULL_BACK, ROLL_ITM, NEAR_ITM_WARNING, ROLL_WEEKLY, CLOSE_CATASTROPHIC, SELL_NEW
 * V3.3 Additions: COMPRESS, MONITOR
 */
export type V3ActionType =
  | 'PULL_BACK'       // Far-dated OTM → shorter duration (stay nimble)
  | 'ROLL_ITM'        // Near-dated ITM (≤60 days) → escape to OTM
  | 'COMPRESS'        // Far-dated ITM (>60 days) → shorter + OTM (V3.3)
  | 'MONITOR'         // Wait for mean reversion opportunity (V3.3)
  | 'NEAR_ITM_WARNING' // OTM but ≤2% from strike
  | 'ROLL_WEEKLY'     // ≥60% profit, roll to next week
  | 'CLOSE_CATASTROPHIC' // Cannot escape within 12 months
  | 'SELL_NEW'        // Sell new covered call
  | 'NO_ACTION';      // Hold current position

/**
 * Legacy strategy types (for backward compatibility)
 */
export type StrategyType =
  | 'early_roll'
  | 'itm_roll'
  | 'preemptive_roll'
  | 'sell_unsold'
  | 'new_covered_call'
  | 'earnings_alert'
  | 'dividend_alert'
  | 'close_early'
  // V3 types (mapped to legacy names)
  | 'pull_back'
  | 'near_itm_warning'
  | 'close_catastrophic'
  // V3.3 types
  | 'compress'
  | 'monitor';

// Recommendation from the algorithm
export interface Recommendation {
  id: string;
  strategyType: StrategyType;
  priority: Priority;
  symbol: string;
  title: string;
  description: string;
  currentStrike?: number;
  currentExpiration?: string;
  currentPremium?: number;
  action: 'roll' | 'close' | 'sell' | 'watch' | 'wait';
  newStrike?: number;
  newExpiration?: string;
  newPremium?: number;
  netCreditOrDebit?: number;
  profitPercent?: number;
  itmPercent?: number;
  otmPercent?: number;
  daysToExpiration?: number;
  executionSteps?: string[];
  liquidity?: 'excellent' | 'good' | 'fair' | 'poor';
  createdAt: Date;
  
  // V3 additions
  v3Action?: V3ActionType;
  weeksSaved?: number;         // For pull-back
  weeksToRoll?: number;        // For ITM roll
  estimatedProbabilityOtm?: number;
}

// Algorithm configuration (Legacy - kept for compatibility)
export interface AlgorithmConfig {
  normalProfitThreshold: number;
  earningsWeekProfitThreshold: number;
  shortDteProfitThreshold: number;
  maxDebitPctOfNewPremium: number;
  approachingThresholdPct: number;
  urgentThresholdPct: number;
  minDaysToExpiration: number;
  probabilityTarget: number;
}

// Default algorithm configuration (Legacy)
export const DEFAULT_CONFIG: AlgorithmConfig = {
  normalProfitThreshold: 0.60,
  earningsWeekProfitThreshold: 0.45,
  shortDteProfitThreshold: 0.35,
  maxDebitPctOfNewPremium: 0.50,
  approachingThresholdPct: 3.0,
  urgentThresholdPct: 1.5,
  minDaysToExpiration: 2,
  probabilityTarget: 0.90,
};

// ============================================================================
// Market Data Types (for API integration)
// ============================================================================

/**
 * Stock quote from market data API
 */
export interface MarketQuote {
  symbol: string;
  currentPrice: number;
  change?: number;
  changePercent?: number;
  previousClose?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  high?: number;
  low?: number;
}

/**
 * Options chain from market data API
 */
export interface OptionsChainData {
  symbol: string;
  underlyingPrice: number;
  expirationDate: string;
  expirations: string[];
  calls: OptionContractData[];
  puts: OptionContractData[];
}

/**
 * Individual option contract data
 */
export interface OptionContractData {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  expirationDate: string;
  midPrice: number;
}

/**
 * Earnings information
 */
export interface EarningsData {
  symbol: string;
  earningsDate: string | null;
  daysUntilEarnings: number | null;
}

/**
 * Dividend information
 */
export interface DividendData {
  symbol: string;
  exDividendDate: string | null;
  dividendAmount: number;
  dividendYield: number;
  daysUntilExDiv: number | null;
}
