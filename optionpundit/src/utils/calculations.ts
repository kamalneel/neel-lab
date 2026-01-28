import { SoldOption, Position, AlgorithmConfig, DEFAULT_CONFIG } from '../types';

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Get the next Friday from today
 */
export function getNextFriday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return date;
}

/**
 * Get the Friday after a given date
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
 * Format date as MM/DD
 */
export function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Format date as MMM DD
 */
export function formatDateMedium(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate profit percentage for an option
 */
export function calculateProfitPercent(
  originalPremium: number,
  currentPremium: number
): number {
  if (originalPremium <= 0) return 0;
  return (originalPremium - currentPremium) / originalPremium;
}

/**
 * Calculate profit amount per share
 */
export function calculateProfitAmount(
  originalPremium: number,
  currentPremium: number
): number {
  return originalPremium - currentPremium;
}

/**
 * Check if a call option is in the money
 */
export function isCallITM(currentPrice: number, strike: number): boolean {
  return currentPrice > strike;
}

/**
 * Check if a put option is in the money  
 */
export function isPutITM(currentPrice: number, strike: number): boolean {
  return currentPrice < strike;
}

/**
 * Check if an option is ITM based on type
 */
export function isITM(
  optionType: 'call' | 'put',
  currentPrice: number,
  strike: number
): boolean {
  if (optionType === 'call') {
    return isCallITM(currentPrice, strike);
  }
  return isPutITM(currentPrice, strike);
}

/**
 * Calculate ITM percentage
 */
export function calculateITMPercent(
  optionType: 'call' | 'put',
  currentPrice: number,
  strike: number
): number {
  if (!isITM(optionType, currentPrice, strike)) {
    return 0;
  }
  
  if (optionType === 'call') {
    return ((currentPrice - strike) / strike) * 100;
  }
  return ((strike - currentPrice) / strike) * 100;
}

/**
 * Calculate OTM percentage
 */
export function calculateOTMPercent(
  optionType: 'call' | 'put',
  currentPrice: number,
  strike: number
): number {
  if (isITM(optionType, currentPrice, strike)) {
    return 0;
  }
  
  if (optionType === 'call') {
    return ((strike - currentPrice) / currentPrice) * 100;
  }
  return ((currentPrice - strike) / currentPrice) * 100;
}

/**
 * Calculate distance to strike as percentage
 */
export function calculateDistanceToStrike(
  currentPrice: number,
  strike: number
): number {
  return Math.abs(currentPrice - strike) / strike * 100;
}

/**
 * Get profit threshold based on conditions
 */
export function getProfitThreshold(
  config: AlgorithmConfig = DEFAULT_CONFIG,
  isEarningsWeek: boolean = false,
  daysToExpiration?: number
): number {
  if (daysToExpiration !== undefined && daysToExpiration <= 3) {
    return config.shortDteProfitThreshold;
  }
  if (isEarningsWeek) {
    return config.earningsWeekProfitThreshold;
  }
  return config.normalProfitThreshold;
}

/**
 * Estimate premium for a new option based on current price and volatility
 * This is a simplified estimate when we don't have real market data
 */
export function estimatePremium(
  currentPrice: number,
  strike: number,
  daysToExpiration: number,
  weeklyVolatility: number = 0.03, // Default 3% weekly volatility
  optionType: 'call' | 'put'
): number {
  // Calculate weeks to expiration
  const weeks = daysToExpiration / 7;
  
  // Calculate OTM percentage
  const otmPct = optionType === 'call'
    ? Math.max(0, (strike - currentPrice) / currentPrice)
    : Math.max(0, (currentPrice - strike) / currentPrice);
  
  // Base premium from time value (simplified)
  const basePremium = currentPrice * weeklyVolatility * Math.sqrt(weeks) * 0.5;
  
  // Reduce premium for further OTM strikes
  const otmFactor = Math.max(0.2, 1 - otmPct * 5);
  
  return basePremium * otmFactor;
}

/**
 * Calculate net cost/credit for a roll
 * Negative = credit (receive money)
 * Positive = debit (pay money)
 */
export function calculateRollNetCost(
  buyBackCost: number,
  newPremium: number
): number {
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
 * Check if roll is worth it based on cost analysis
 */
export function isRollWorthIt(
  netCost: number,
  newPremium: number,
  remainingPremium: number,
  config: AlgorithmConfig = DEFAULT_CONFIG
): { worthIt: boolean; reason: string } {
  // Credit is always worth it
  if (netCost < 0) {
    return { worthIt: true, reason: 'Roll results in a credit' };
  }
  
  // Debit analysis
  if (remainingPremium > 0 && netCost > remainingPremium) {
    return {
      worthIt: false,
      reason: `Debit ($${netCost.toFixed(2)}) exceeds remaining premium ($${remainingPremium.toFixed(2)})`
    };
  }
  
  if (newPremium > 0 && netCost > newPremium * config.maxDebitPctOfNewPremium) {
    return {
      worthIt: false,
      reason: `Debit exceeds ${config.maxDebitPctOfNewPremium * 100}% of new premium`
    };
  }
  
  return { worthIt: true, reason: 'Roll is economically reasonable' };
}

/**
 * Calculate probability of staying OTM based on distance and volatility
 * Simplified approximation
 */
export function estimateProbabilityOTM(
  distancePercent: number,
  weeklyVolatility: number,
  weeks: number
): number {
  // Simplified normal distribution approximation
  // Number of standard deviations away
  const adjustedVolatility = weeklyVolatility * Math.sqrt(weeks);
  const zScore = distancePercent / 100 / adjustedVolatility;
  
  // Approximate cumulative normal distribution
  // For positive z-scores, this gives probability of staying below
  const prob = 0.5 * (1 + Math.tanh(zScore * 0.7));
  
  return Math.min(0.99, Math.max(0.01, prob)) * 100;
}

/**
 * Find contracts that could be sold (unsold shares)
 */
export function findUnsoldContracts(
  positions: Position[],
  soldOptions: SoldOption[]
): Array<{ position: Position; unsoldContracts: number }> {
  const result: Array<{ position: Position; unsoldContracts: number }> = [];
  
  for (const position of positions) {
    // Count how many contracts are sold for this symbol
    const soldContracts = soldOptions
      .filter(opt => opt.symbol === position.symbol && opt.optionType === 'call')
      .reduce((sum, opt) => sum + opt.contracts, 0);
    
    // How many contracts possible with this position
    const possibleContracts = Math.floor(position.shares / 100);
    
    const unsoldContracts = possibleContracts - soldContracts;
    
    if (unsoldContracts > 0) {
      result.push({ position, unsoldContracts });
    }
  }
  
  return result;
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
 * Format large currency with K/M suffixes
 */
export function formatCurrencyCompact(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

