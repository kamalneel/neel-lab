import {
  SoldOption,
  Position,
  Recommendation,
  Priority,
  StrategyType,
  AlgorithmConfig,
  DEFAULT_CONFIG,
  V3ActionType,
  MarketQuote,
} from '../types';
import {
  daysBetween,
  getFridayAfter,
  formatDateMedium,
  calculateProfitPercent,
  isITM,
  calculateITMPercent,
  calculateDistanceToStrike,
  getProfitThreshold,
  estimatePremium,
  calculateRollNetCost,
  formatNetCost,
  isRollWorthIt,
  findUnsoldContracts,
  parseDate,
  formatCurrency,
  formatPercent,
} from './calculations';

// V3 Algorithm imports (ported from agrawal-estate-planner)
import {
  evaluatePosition,
  evaluateStockForCoveredCall,
  EvaluationContext,
  EvaluationResult,
  PositionForEvaluation,
  StockHolding,
  DEFAULT_CONFIG_V3,
} from '../algorithm';

/**
 * Generate all recommendations for a set of positions and options
 */
export function generateRecommendations(
  positions: Position[],
  soldOptions: SoldOption[],
  config: AlgorithmConfig = DEFAULT_CONFIG
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const today = new Date();
  
  // Analyze each sold option
  for (const option of soldOptions) {
    const expirationDate = parseDate(option.expiration);
    const daysToExpiration = daysBetween(today, expirationDate);
    
    // Skip expired options
    if (daysToExpiration < 0) continue;
    
    // Find the corresponding position
    const position = positions.find(p => p.symbol === option.symbol);
    const currentPrice = position?.currentPrice || option.currentPremium ? estimateStockPrice(option) : null;
    
    if (!currentPrice) continue;
    
    // Calculate current premium if not provided
    const currentPremium = option.currentPremium ?? estimateCurrentPremium(option, daysToExpiration);
    const profitPercent = calculateProfitPercent(option.premium, currentPremium);
    
    // Check ITM status
    const optionIsITM = isITM(option.optionType, currentPrice, option.strike);
    const itmPercent = calculateITMPercent(option.optionType, currentPrice, option.strike);
    
    // ========== SCENARIO C: ITM Roll ==========
    if (optionIsITM && itmPercent >= 1.0) {
      const rec = generateITMRollRecommendation(
        option,
        currentPrice,
        currentPremium,
        itmPercent,
        daysToExpiration,
        config
      );
      if (rec) recommendations.push(rec);
      continue;
    }
    
    // ========== SCENARIO A: Early Roll (Profit Target Hit) ==========
    const profitThreshold = getProfitThreshold(config, false, daysToExpiration);
    if (profitPercent >= profitThreshold) {
      const rec = generateEarlyRollRecommendation(
        option,
        currentPrice,
        currentPremium,
        profitPercent,
        daysToExpiration,
        config
      );
      if (rec) recommendations.push(rec);
      continue;
    }
    
    // ========== SCENARIO D: Preemptive Roll (Approaching Strike) ==========
    if (!optionIsITM && daysToExpiration > config.minDaysToExpiration) {
      const distancePercent = calculateDistanceToStrike(currentPrice, option.strike);
      
      if (distancePercent <= config.approachingThresholdPct) {
        const rec = generatePreemptiveRollRecommendation(
          option,
          currentPrice,
          currentPremium,
          distancePercent,
          daysToExpiration,
          config
        );
        if (rec) recommendations.push(rec);
      }
    }
  }
  
  // ========== SELL UNSOLD CONTRACTS ==========
  const unsoldContracts = findUnsoldContracts(positions, soldOptions);
  for (const { position, unsoldContracts: count } of unsoldContracts) {
    if (position.currentPrice) {
      const rec = generateSellUnsoldRecommendation(position, count, config);
      if (rec) recommendations.push(rec);
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
  
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

/**
 * Estimate stock price from option if not provided
 */
function estimateStockPrice(_option: SoldOption): number | null {
  // If we have current premium, we can make rough estimate
  // This is a fallback - real implementation would use market data
  return null;
}

/**
 * Estimate current premium based on time decay
 */
function estimateCurrentPremium(option: SoldOption, daysToExpiration: number): number {
  // Simple time decay model
  // Assumes theta decay accelerates near expiration
  const originalDays = 7; // Assume weekly options
  const remainingRatio = Math.sqrt(daysToExpiration / originalDays);
  return option.premium * remainingRatio;
}

/**
 * Generate ITM Roll recommendation (Scenario C)
 */
function generateITMRollRecommendation(
  option: SoldOption,
  currentPrice: number,
  currentPremium: number,
  itmPercent: number,
  daysToExpiration: number,
  config: AlgorithmConfig
): Recommendation | null {
  const expirationDate = parseDate(option.expiration);
  
  // Calculate buy-back cost (current premium)
  const buyBackCost = currentPremium;
  
  // Suggest rolling to a higher/lower strike based on option type
  const newStrike = option.optionType === 'call'
    ? Math.ceil(currentPrice * 1.05 / 5) * 5  // 5% above current, rounded to $5
    : Math.floor(currentPrice * 0.95 / 5) * 5; // 5% below current, rounded to $5
  
  // Roll 2 weeks out for ITM
  const newExpiration = getFridayAfter(getFridayAfter(expirationDate));
  const newDaysToExp = daysBetween(new Date(), newExpiration);
  
  // Estimate new premium
  const newPremium = estimatePremium(
    currentPrice,
    newStrike,
    newDaysToExp,
    0.03,
    option.optionType
  );
  
  const netCost = calculateRollNetCost(buyBackCost, newPremium);
  const { worthIt, reason } = isRollWorthIt(netCost, newPremium, option.premium - buyBackCost, config);
  
  // Determine priority
  let priority: Priority = 'high';
  if (itmPercent >= 5) priority = 'urgent';
  if (daysToExpiration <= 1) priority = 'urgent';
  
  const id = `itm_roll_${option.symbol}_${option.strike}_${Date.now()}`;
  
  // Calculate OTM distance for new position
  const newOtmDistance = option.optionType === 'call'
    ? ((newStrike - currentPrice) / currentPrice) * 100
    : ((currentPrice - newStrike) / currentPrice) * 100;
  // Delta 30 for ITM rolls = ~70% probability OTM
  const estimatedProbOtm = 70;
  // Weeks to roll (2 weeks for ITM)
  const weeksToRoll = 2;

  return {
    id,
    strategyType: 'itm_roll',
    priority,
    symbol: option.symbol,
    title: `ROLL ITM ${option.symbol} $${option.strike}→$${newStrike} ${option.optionType} (${formatNetCost(netCost)})`,
    description: `${option.symbol} is ${formatPercent(itmPercent)} ITM. Stock at ${formatCurrency(currentPrice)} vs $${option.strike} strike. ${worthIt ? 'Roll recommended.' : reason}`,
    currentStrike: option.strike,
    currentExpiration: option.expiration,
    currentPremium: currentPremium,
    action: 'roll',
    newStrike,
    newExpiration: newExpiration.toISOString().split('T')[0],
    newPremium,
    netCreditOrDebit: netCost,
    profitPercent: calculateProfitPercent(option.premium, currentPremium) * 100,
    itmPercent,
    daysToExpiration,
    v3Action: 'ROLL_ITM',
    weeksToRoll,
    estimatedProbabilityOtm: estimatedProbOtm,
    otmPercent: Math.max(0, newOtmDistance),
    executionSteps: [
      `Buy to close ${option.contracts}x $${option.strike} ${option.optionType} at ~${formatCurrency(buyBackCost)}`,
      `Sell ${option.contracts}x $${newStrike} ${option.optionType} for ${formatDateMedium(newExpiration)} at ~${formatCurrency(newPremium)}`,
      `Roll ${weeksToRoll} weeks out to escape ITM (Delta ~30, ~70% win rate)`,
      `Net: ${formatNetCost(netCost)}/share`,
    ],
    createdAt: new Date(),
  };
}

/**
 * Generate Early Roll recommendation (Scenario A)
 */
function generateEarlyRollRecommendation(
  option: SoldOption,
  currentPrice: number,
  currentPremium: number,
  profitPercent: number,
  daysToExpiration: number,
  config: AlgorithmConfig
): Recommendation | null {
  const expirationDate = parseDate(option.expiration);
  const buyBackCost = currentPremium;
  
  // Calculate new strike (Delta 10 approximation)
  // For calls: ~5% above current price
  // For puts: ~5% below current price
  const newStrike = option.optionType === 'call'
    ? Math.ceil(currentPrice * 1.05 / 5) * 5
    : Math.floor(currentPrice * 0.95 / 5) * 5;
  
  // Roll to next Friday
  const newExpiration = getFridayAfter(expirationDate);
  const newDaysToExp = daysBetween(new Date(), newExpiration);
  
  // Estimate new premium
  const newPremium = estimatePremium(
    currentPrice,
    newStrike,
    newDaysToExp,
    0.03,
    option.optionType
  );
  
  const netCost = calculateRollNetCost(buyBackCost, newPremium);
  const { worthIt } = isRollWorthIt(netCost, newPremium, option.premium - buyBackCost, config);
  
  if (!worthIt) return null;
  
  // Determine priority
  let priority: Priority = 'medium';
  if (profitPercent >= 0.90) priority = 'high';
  if (daysToExpiration <= 2) priority = 'high';
  if (daysToExpiration <= 1) priority = 'urgent';
  
  const estimatedIncome = (newPremium - buyBackCost) * option.contracts * 100;
  
  const id = `early_roll_${option.symbol}_${option.strike}_${Date.now()}`;
  
  // Calculate OTM distance for new position
  const newOtmDistance = option.optionType === 'call'
    ? ((newStrike - currentPrice) / currentPrice) * 100
    : ((currentPrice - newStrike) / currentPrice) * 100;
  // Delta 10 for weekly rolls = ~90% probability OTM
  const estimatedProbOtm = 90;

  return {
    id,
    strategyType: 'early_roll',
    priority,
    symbol: option.symbol,
    title: `Roll ${option.contracts} ${option.symbol} $${option.strike}→$${newStrike} (${formatDateMedium(expirationDate)}→${formatDateMedium(newExpiration)}) - Earn ~${formatCurrency(estimatedIncome)}`,
    description: `${formatPercent(profitPercent * 100)} profit captured with ${daysToExpiration} days left. Roll to collect new premium.`,
    currentStrike: option.strike,
    currentExpiration: option.expiration,
    currentPremium,
    action: 'roll',
    newStrike,
    newExpiration: newExpiration.toISOString().split('T')[0],
    newPremium,
    netCreditOrDebit: netCost,
    profitPercent: profitPercent * 100,
    daysToExpiration,
    v3Action: 'ROLL_WEEKLY',
    estimatedProbabilityOtm: estimatedProbOtm,
    otmPercent: newOtmDistance,
    executionSteps: [
      `Buy to close $${option.strike} ${option.optionType} at ~${formatCurrency(buyBackCost)}`,
      `Sell $${newStrike} ${option.optionType} for ${formatDateMedium(newExpiration)} at ~${formatCurrency(newPremium)}`,
      `New strike is ${newOtmDistance.toFixed(1)}% OTM (Delta ~10, ~90% win rate)`,
      `Expected credit: ${formatNetCost(netCost)}`,
    ],
    createdAt: new Date(),
  };
}

/**
 * Generate Preemptive Roll recommendation (Scenario D)
 */
function generatePreemptiveRollRecommendation(
  option: SoldOption,
  currentPrice: number,
  currentPremium: number,
  distancePercent: number,
  daysToExpiration: number,
  config: AlgorithmConfig
): Recommendation | null {
  const expirationDate = parseDate(option.expiration);
  
  // Determine if stock is moving toward strike
  // In real implementation, this would check price momentum
  const isApproachingFromBelow = option.optionType === 'call' && currentPrice < option.strike;
  const isApproachingFromAbove = option.optionType === 'put' && currentPrice > option.strike;
  
  if (!isApproachingFromBelow && !isApproachingFromAbove) return null;
  
  // Suggest rolling to higher/lower strike, 2 weeks out
  const newStrike = option.optionType === 'call'
    ? Math.ceil(currentPrice * 1.07 / 5) * 5  // 7% above current
    : Math.floor(currentPrice * 0.93 / 5) * 5; // 7% below current
  
  const newExpiration = getFridayAfter(getFridayAfter(expirationDate));
  const newDaysToExp = daysBetween(new Date(), newExpiration);
  
  const buyBackCost = currentPremium;
  const newPremium = estimatePremium(currentPrice, newStrike, newDaysToExp, 0.03, option.optionType);
  const netCost = calculateRollNetCost(buyBackCost, newPremium);
  
  // Determine priority based on distance
  let priority: Priority = 'high';
  if (distancePercent <= config.urgentThresholdPct) {
    priority = 'urgent';
  }
  
  const id = `preemptive_roll_${option.symbol}_${option.strike}_${Date.now()}`;
  
  // Calculate OTM distance for new position
  const newOtmDistance = option.optionType === 'call'
    ? ((newStrike - currentPrice) / currentPrice) * 100
    : ((currentPrice - newStrike) / currentPrice) * 100;
  // Delta 15 for preemptive = ~85% probability OTM
  const estimatedProbOtm = 85;

  return {
    id,
    strategyType: 'preemptive_roll',
    priority,
    symbol: option.symbol,
    title: `⚠️ ${option.symbol} approaching $${option.strike} strike · Stock ${formatCurrency(currentPrice)} (${formatPercent(distancePercent)} away)`,
    description: `Stock is ${formatPercent(distancePercent)} from your $${option.strike} ${option.optionType} strike with ${daysToExpiration} days to expiration. Consider preemptive roll to avoid ITM.`,
    currentStrike: option.strike,
    currentExpiration: option.expiration,
    currentPremium,
    action: 'roll',
    newStrike,
    newExpiration: newExpiration.toISOString().split('T')[0],
    newPremium,
    netCreditOrDebit: netCost,
    otmPercent: distancePercent,
    daysToExpiration,
    v3Action: 'NEAR_ITM_WARNING',
    estimatedProbabilityOtm: estimatedProbOtm,
    executionSteps: [
      `Monitor closely - stock only ${distancePercent.toFixed(1)}% from strike`,
      `If momentum continues, roll to $${newStrike} for ${formatDateMedium(newExpiration)}`,
      `New strike is ${newOtmDistance.toFixed(1)}% OTM (Delta ~15, ~85% win rate)`,
      `Current cost to roll: ${formatNetCost(netCost)}`,
    ],
    createdAt: new Date(),
  };
}

/**
 * Generate Sell Unsold Contracts recommendation
 */
function generateSellUnsoldRecommendation(
  position: Position,
  unsoldContracts: number,
  _config: AlgorithmConfig
): Recommendation | null {
  const currentPrice = position.currentPrice!;
  
  // Calculate Delta 10 strike (~5% above for calls)
  const recommendedStrike = Math.ceil(currentPrice * 1.05 / 5) * 5;
  
  // Next Friday
  const nextFriday = getFridayAfter(new Date());
  const daysToExp = daysBetween(new Date(), nextFriday);
  
  // Estimate premium
  const estimatedPremium = estimatePremium(currentPrice, recommendedStrike, daysToExp, 0.03, 'call');
  const weeklyIncome = estimatedPremium * unsoldContracts * 100;
  const yearlyIncome = weeklyIncome * 50; // 50 weeks
  
  // Calculate OTM distance and probability
  const otmDistance = ((recommendedStrike - currentPrice) / currentPrice) * 100;
  // Delta 10 = ~90% probability OTM
  const estimatedProbOtm = 90;
  
  // Determine priority based on income potential
  let priority: Priority = 'medium';
  if (yearlyIncome >= 5000) priority = 'high';
  
  const id = `sell_unsold_${position.symbol}_${Date.now()}`;
  
  return {
    id,
    strategyType: 'sell_unsold',
    priority,
    symbol: position.symbol,
    title: `Sell ${unsoldContracts} ${position.symbol} call(s) at $${recommendedStrike} for ${formatDateMedium(nextFriday)}`,
    description: `You have ${position.shares} shares (${Math.floor(position.shares / 100)} possible contracts) but only ${Math.floor(position.shares / 100) - unsoldContracts} sold. Generate ~${formatCurrency(weeklyIncome)}/week, ~${formatCurrency(yearlyIncome)}/year.`,
    action: 'sell',
    newStrike: recommendedStrike,
    newExpiration: nextFriday.toISOString().split('T')[0],
    newPremium: estimatedPremium,
    daysToExpiration: daysToExp,
    otmPercent: otmDistance,
    estimatedProbabilityOtm: estimatedProbOtm,
    v3Action: 'SELL_NEW',
    executionSteps: [
      `Sell ${unsoldContracts}x ${position.symbol} $${recommendedStrike} call for ${formatDateMedium(nextFriday)}`,
      `Strike is ${otmDistance.toFixed(1)}% OTM (Delta ~10, ~90% win rate)`,
      `Estimated premium: ~${formatCurrency(estimatedPremium)}/share`,
      `Total income: ~${formatCurrency(weeklyIncome)}`,
    ],
    createdAt: new Date(),
  };
}

/**
 * Generate a summary of all recommendations
 */
export function generateSummary(recommendations: Recommendation[]): {
  totalRecommendations: number;
  urgentCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  potentialIncome: number;
  byStrategy: Record<StrategyType, number>;
} {
  const byPriority: Record<string, number> = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  
  const byStrategy: Record<string, number> = {};
  let potentialIncome = 0;
  
  for (const rec of recommendations) {
    byPriority[rec.priority] = (byPriority[rec.priority] || 0) + 1;
    byStrategy[rec.strategyType] = (byStrategy[rec.strategyType] || 0) + 1;
    
    if (rec.netCreditOrDebit && rec.netCreditOrDebit < 0) {
      potentialIncome += Math.abs(rec.netCreditOrDebit) * 100; // Assuming 1 contract
    }
  }
  
  return {
    totalRecommendations: recommendations.length,
    urgentCount: byPriority.urgent,
    highCount: byPriority.high,
    mediumCount: byPriority.medium,
    lowCount: byPriority.low,
    potentialIncome,
    byStrategy: byStrategy as Record<StrategyType, number>,
  };
}

// =============================================================================
// V3 ALGORITHM INTEGRATION
// Ported from agrawal-estate-planner
// =============================================================================

/**
 * Map V3.3 action types to legacy strategy types
 */
function mapV3ActionToStrategyType(action: V3ActionType): StrategyType {
  const mapping: Record<V3ActionType, StrategyType> = {
    PULL_BACK: 'pull_back',
    ROLL_ITM: 'itm_roll',
    COMPRESS: 'compress',         // V3.3: Far-dated ITM → shorter + OTM
    MONITOR: 'monitor',           // V3.3: Wait for mean reversion
    NEAR_ITM_WARNING: 'near_itm_warning',
    ROLL_WEEKLY: 'early_roll',
    CLOSE_CATASTROPHIC: 'close_catastrophic',
    SELL_NEW: 'sell_unsold',
    NO_ACTION: 'early_roll', // Shouldn't happen but provide fallback
  };
  return mapping[action];
}

/**
 * Map V3 priority to legacy priority
 */
function mapV3Priority(priority: 'urgent' | 'high' | 'medium' | 'low' | 'info'): Priority {
  if (priority === 'info') return 'low';
  return priority;
}

/**
 * Map V3.3 action to legacy action
 */
function mapV3Action(action: V3ActionType): 'roll' | 'close' | 'sell' | 'watch' | 'wait' {
  switch (action) {
    case 'PULL_BACK':
    case 'ROLL_ITM':
    case 'ROLL_WEEKLY':
    case 'COMPRESS':  // V3.3: Similar to roll but for far-dated ITM
      return 'roll';
    case 'CLOSE_CATASTROPHIC':
      return 'close';
    case 'SELL_NEW':
      return 'sell';
    case 'NEAR_ITM_WARNING':
      return 'watch';
    case 'MONITOR':   // V3.3: Wait for mean reversion
      return 'wait';
    default:
      return 'wait';
  }
}

/**
 * Convert V3 EvaluationResult to legacy Recommendation format
 */
function convertV3ResultToRecommendation(
  result: EvaluationResult,
  option?: SoldOption
): Recommendation {
  const id = `v3_${result.action.toLowerCase()}_${result.symbol}_${Date.now()}`;
  
  // Build execution steps based on action
  const executionSteps: string[] = [];
  
  if (result.action === 'ROLL_ITM' && result.zeroCostData) {
    const zc = result.zeroCostData;
    executionSteps.push(
      `Buy to close current $${option?.strike || 'X'} ${option?.optionType || 'call'} at market`,
      `Sell $${zc.strike.toFixed(2)} ${option?.optionType || 'call'} for ${formatDateMedium(zc.expirationDate)} at ~${formatCurrency(zc.newPremium)}`,
      `Net cost: ${zc.isCredit ? 'Credit' : 'Debit'} of ${formatCurrency(Math.abs(zc.netCost))}/share`,
      `Rolling ${zc.weeksOut} weeks out to escape ITM`
    );
  } else if (result.action === 'PULL_BACK' && result.pullBackData) {
    const pb = result.pullBackData;
    executionSteps.push(
      `Buy to close current position at ~${formatCurrency(pb.currentValue)}`,
      `Sell $${pb.newStrike.toFixed(2)} for ${formatDateMedium(pb.toExpiration)} at ~${formatCurrency(pb.newPremium)}`,
      `Net cost: ${formatCurrency(Math.abs(pb.netCost))} ${pb.netCost > 0 ? 'debit' : 'credit'}`,
      pb.benefit
    );
  } else if (result.action === 'ROLL_WEEKLY' && result.newStrike && result.newExpiration) {
    executionSteps.push(
      `Buy to close current option at market`,
      `Sell $${result.newStrike.toFixed(2)} for ${formatDateMedium(result.newExpiration)}`,
      `Capture profit and continue income generation`
    );
  } else if (result.action === 'NEAR_ITM_WARNING' && result.newStrike && result.newExpiration) {
    executionSteps.push(
      `Monitor position closely - stock approaching strike`,
      `Consider rolling to $${result.newStrike.toFixed(2)} for ${formatDateMedium(result.newExpiration)}`,
      `Act before position goes ITM to avoid losses`
    );
  } else if (result.action === 'CLOSE_CATASTROPHIC') {
    executionSteps.push(
      `Consider closing this position to cut losses`,
      `No cost-neutral roll available within 12 months`,
      `Alternative: Wait for stock to recover if you believe it will`
    );
  } else if (result.action === 'SELL_NEW' && result.newStrike && result.newExpiration) {
    executionSteps.push(
      `Sell covered call at $${result.newStrike.toFixed(2)} strike`,
      `Expiration: ${formatDateMedium(result.newExpiration)}`,
      `Start generating weekly income`
    );
  } else if (result.action === 'COMPRESS' && result.newStrike && result.newExpiration) {
    // V3.3: COMPRESS action for far-dated ITM or weekly income compress
    const zc = result.zeroCostData;
    executionSteps.push(
      `Buy to close current position at market`,
      `Sell $${result.newStrike.toFixed(2)} for ${formatDateMedium(result.newExpiration)}`,
      zc ? `Net cost: ${zc.isCredit ? 'Credit' : 'Debit'} of ${formatCurrency(Math.abs(zc.netCost))}/share` : '',
      `Compressing to shorter duration for mean reversion opportunity`
    );
  } else if (result.action === 'MONITOR') {
    // V3.3: MONITOR action - wait for mean reversion
    executionSteps.push(
      `Hold current position and monitor for mean reversion`,
      `Stock may recover before expiration`,
      `Check back in 2-3 days for updated recommendation`
    );
  }

  // Build title based on action
  let title = result.reason;
  if (result.action === 'ROLL_ITM' && result.zeroCostData) {
    const zc = result.zeroCostData;
    title = `ROLL ITM ${result.symbol} → $${zc.strike.toFixed(2)} in ${zc.weeksOut}w (${zc.isCredit ? 'credit' : formatCurrency(zc.netCost) + ' debit'})`;
  } else if (result.action === 'PULL_BACK' && result.pullBackData) {
    const pb = result.pullBackData;
    title = `PULL BACK ${result.symbol} from ${pb.fromWeeks}w → ${pb.toWeeks}w (save ${pb.weeksSaved} weeks)`;
  } else if (result.action === 'CLOSE_CATASTROPHIC') {
    title = `🚨 CATASTROPHIC: Close ${result.symbol} - No escape possible`;
  } else if (result.action === 'NEAR_ITM_WARNING') {
    title = `⚠️ ${result.symbol} near strike - ${(result.details.otmPct as number || 0).toFixed(1)}% OTM`;
  } else if (result.action === 'COMPRESS' && result.zeroCostData) {
    // V3.3: COMPRESS title
    const zc = result.zeroCostData;
    const itmPct = result.details.itmPct as number || 0;
    title = `COMPRESS ${result.symbol} ${itmPct.toFixed(1)}% ITM → $${zc.strike.toFixed(2)} in ${zc.weeksOut}w`;
  } else if (result.action === 'MONITOR') {
    // V3.3: MONITOR title
    const itmPct = result.details.itmPct as number || 0;
    const daysToExp = result.details.daysToExp as number || 0;
    title = `MONITOR ${result.symbol} - ${itmPct.toFixed(1)}% ITM, ${daysToExp} days left`;
  }

  return {
    id,
    strategyType: mapV3ActionToStrategyType(result.action),
    priority: mapV3Priority(result.priority),
    symbol: result.symbol,
    title,
    description: result.reason,
    currentStrike: option?.strike,
    currentExpiration: option?.expiration,
    currentPremium: option?.currentPremium,
    action: mapV3Action(result.action),
    newStrike: result.newStrike,
    newExpiration: result.newExpiration?.toISOString().split('T')[0],
    newPremium: result.zeroCostData?.newPremium || result.pullBackData?.newPremium,
    netCreditOrDebit: result.netCost,
    itmPercent: result.details.itmPct as number | undefined,
    otmPercent: result.details.otmPct as number | undefined,
    daysToExpiration: result.details.daysToExpiry as number | undefined,
    executionSteps,
    createdAt: new Date(),
    v3Action: result.action,
    weeksSaved: result.pullBackData?.weeksSaved,
    weeksToRoll: result.zeroCostData?.weeksOut,
    estimatedProbabilityOtm: result.zeroCostData?.probabilityOtm,
  };
}

/**
 * Generate recommendations using V3 algorithm
 *
 * This is the new V3-based recommendation generator that uses the ported
 * algorithm from Agrawal Estate Planner.
 *
 * @param positions - Stock holdings
 * @param soldOptions - Sold options
 * @param quotes - Market quotes for each symbol
 * @returns Array of recommendations
 */
export function generateRecommendationsV3(
  positions: Position[],
  soldOptions: SoldOption[],
  quotes: Map<string, MarketQuote>
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Convert sold options to V3 format and evaluate
  for (const option of soldOptions) {
    const quote = quotes.get(option.symbol);
    if (!quote) continue;    const positionForEval: PositionForEvaluation = {
      symbol: option.symbol,
      optionType: option.optionType,
      strike: option.strike,
      expiration: option.expiration,
      contracts: option.contracts,
      premium: option.premium,
      currentPremium: option.currentPremium,
      currentPrice: quote.currentPrice,
    };

    const context: EvaluationContext = {
      currentPrice: quote.currentPrice,
      config: DEFAULT_CONFIG_V3,
    };

    const result = evaluatePosition(positionForEval, context);
    
    if (result) {
      const rec = convertV3ResultToRecommendation(result, option);
      recommendations.push(rec);
    }
  }

  // Evaluate stock holdings for new covered calls
  const symbolsWithOptions = new Set(soldOptions.map(o => o.symbol));

  for (const position of positions) {
    // Skip if already has options
    if (symbolsWithOptions.has(position.symbol)) continue;
    
    const quote = quotes.get(position.symbol);
    if (!quote) continue;

    const holdingForEval: StockHolding = {
      symbol: position.symbol,
      shares: position.shares,
      avgCost: position.avgCost,
      currentPrice: quote.currentPrice,
    };    const context: EvaluationContext = {
      currentPrice: quote.currentPrice,
      config: DEFAULT_CONFIG_V3,
    };

    const result = evaluateStockForCoveredCall(holdingForEval, context);
    
    if (result) {
      const rec = convertV3ResultToRecommendation(result);
      recommendations.push(rec);
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

  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Use V3 algorithm with fallback to V2
 *
 * When market quotes are available, use V3. Otherwise fall back to V2.
 */
export function generateRecommendationsAuto(
  positions: Position[],
  soldOptions: SoldOption[],
  quotes?: Map<string, MarketQuote>,
  config: AlgorithmConfig = DEFAULT_CONFIG
): Recommendation[] {
  // If we have quotes, use V3 algorithm
  if (quotes && quotes.size > 0) {
    return generateRecommendationsV3(positions, soldOptions, quotes);
  }
  
  // Fall back to V2 (legacy)
  return generateRecommendations(positions, soldOptions, config);
}