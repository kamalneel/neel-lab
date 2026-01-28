import { useState } from 'react';
import { Recommendation, Priority, V3ActionType } from '../types';

interface RecommendationCardProps {
  recommendation: Recommendation;
}

const priorityConfig: Record<Priority, { label: string; class: string; emoji: string }> = {
  urgent: { label: 'URGENT', class: 'priority-urgent', emoji: '🚨' },
  high: { label: 'HIGH', class: 'priority-high', emoji: '⚡' },
  medium: { label: 'MEDIUM', class: 'priority-medium', emoji: '📊' },
  low: { label: 'LOW', class: 'priority-low', emoji: '📝' },
  info: { label: 'INFO', class: 'priority-low', emoji: 'ℹ️' },
};

const strategyLabels: Record<string, string> = {
  early_roll: 'Weekly Roll',
  itm_roll: 'ITM Escape',
  preemptive_roll: 'Near ITM',
  sell_unsold: 'New Sell',
  new_covered_call: 'New Call',
  earnings_alert: 'Earnings',
  dividend_alert: 'Dividend',
  close_early: 'Close Early',
  // V3 labels
  pull_back: 'Pull Back',
  near_itm_warning: 'Near ITM ⚠️',
  close_catastrophic: 'Close Position 🚨',
};

/**
 * V3 action type to display info
 */
const v3ActionDisplay: Record<V3ActionType, { label: string; description: string; color: string }> = {
  PULL_BACK: {
    label: 'Pull Back',
    description: 'Return to shorter duration',
    color: 'text-blue-400',
  },
  ROLL_ITM: {
    label: 'ITM Escape',
    description: 'Roll to avoid assignment',
    color: 'text-orange-400',
  },
  COMPRESS: {
    label: 'Compress',
    description: 'Shorten far-dated ITM position',
    color: 'text-purple-400',
  },
  MONITOR: {
    label: 'Monitor',
    description: 'Wait for mean reversion',
    color: 'text-cyan-400',
  },
  NEAR_ITM_WARNING: {
    label: 'Near Strike',
    description: 'Close to becoming ITM',
    color: 'text-yellow-400',
  },
  ROLL_WEEKLY: {
    label: 'Weekly Roll',
    description: 'Capture profit, continue',
    color: 'text-green-400',
  },
  CLOSE_CATASTROPHIC: {
    label: 'Close Position',
    description: 'No escape possible',
    color: 'text-red-500',
  },
  SELL_NEW: {
    label: 'Sell New',
    description: 'Start income generation',
    color: 'text-green-400',
  },
  NO_ACTION: {
    label: 'Hold',
    description: 'No action needed',
    color: 'text-gray-400',
  },
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = priorityConfig[recommendation.priority];
  const strategyLabel = strategyLabels[recommendation.strategyType] || recommendation.strategyType;

  return (
    <div
      className={`recommendation-card ${recommendation.priority} cursor-pointer`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Priority Badge & Strategy */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.class}`}>
              {config.emoji} {config.label}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-[var(--color-bg)] text-[var(--color-text-muted)]">
              {strategyLabel}
            </span>
          </div>
          
          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-1">
            {recommendation.title}
          </h3>
          
          {/* Description */}
          <p className="text-[var(--color-text-muted)] text-sm">
            {recommendation.description}
          </p>
        </div>

        {/* Net Credit/Debit Badge */}
        {recommendation.netCreditOrDebit !== undefined && (
          <div className={`text-right ${recommendation.netCreditOrDebit < 0 ? 'profit' : 'loss'}`}>
            <div className="text-lg font-bold">
              {recommendation.netCreditOrDebit < 0 ? '+' : '-'}
              ${Math.abs(recommendation.netCreditOrDebit).toFixed(2)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {recommendation.netCreditOrDebit < 0 ? 'credit' : 'debit'}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] animate-fade-in">
          {/* V3 Action Info Banner */}
          {recommendation.v3Action && v3ActionDisplay[recommendation.v3Action] && (
            <div className={`mb-4 p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]`}>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${v3ActionDisplay[recommendation.v3Action].color}`}>
                  {v3ActionDisplay[recommendation.v3Action].label}
                </span>
                <span className="text-[var(--color-text-muted)] text-sm">
                  — {v3ActionDisplay[recommendation.v3Action].description}
                </span>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {recommendation.currentStrike && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">Current Strike</div>
                <div className="text-white font-medium">${recommendation.currentStrike}</div>
              </div>
            )}
            {recommendation.newStrike && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">New Strike</div>
                <div className="text-white font-medium">${recommendation.newStrike}</div>
              </div>
            )}
            {recommendation.profitPercent !== undefined && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">Profit Captured</div>
                <div className="profit font-medium">{recommendation.profitPercent.toFixed(0)}%</div>
              </div>
            )}
            {recommendation.itmPercent !== undefined && recommendation.itmPercent > 0 && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">ITM %</div>
                <div className="loss font-medium">{recommendation.itmPercent.toFixed(1)}%</div>
              </div>
            )}
            {recommendation.otmPercent !== undefined && recommendation.otmPercent > 0 && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">OTM Distance</div>
                <div className={`font-medium ${recommendation.otmPercent <= 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {recommendation.otmPercent.toFixed(1)}%
                </div>
              </div>
            )}
            {recommendation.daysToExpiration !== undefined && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">Days to Exp</div>
                <div className={`font-medium ${recommendation.daysToExpiration <= 2 ? 'loss' : 'text-white'}`}>
                  {recommendation.daysToExpiration}
                </div>
              </div>
            )}
            {recommendation.newPremium !== undefined && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">New Premium</div>
                <div className="text-white font-medium">${recommendation.newPremium.toFixed(2)}</div>
              </div>
            )}
            {/* V3: Probability OTM for roll recommendations */}
            {recommendation.estimatedProbabilityOtm !== undefined && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">Prob OTM</div>
                <div className={`font-medium ${
                  recommendation.estimatedProbabilityOtm >= 80 ? 'text-green-400' :
                  recommendation.estimatedProbabilityOtm >= 60 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  {recommendation.estimatedProbabilityOtm.toFixed(0)}%
                </div>
              </div>
            )}
            {/* V3: Weeks to roll for ITM escapes */}
            {recommendation.weeksToRoll !== undefined && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">Roll Duration</div>
                <div className="text-white font-medium">
                  {recommendation.weeksToRoll} week{recommendation.weeksToRoll !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            {/* V3: Weeks saved for pull-backs */}
            {recommendation.weeksSaved !== undefined && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] uppercase">Weeks Saved</div>
                <div className="text-green-400 font-medium">
                  {recommendation.weeksSaved} week{recommendation.weeksSaved !== 1 ? 's' : ''} ✓
                </div>
              </div>
            )}
          </div>

          {/* Execution Steps */}
          {recommendation.executionSteps && recommendation.executionSteps.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-[var(--color-text-muted)] uppercase mb-2">Execution Steps</div>
              <ol className="list-decimal list-inside space-y-1">
                {recommendation.executionSteps.map((step, i) => (
                  <li key={i} className="text-sm text-white">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Liquidity Indicator */}
          {recommendation.liquidity && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Liquidity:</span>
              <span className={`text-xs font-medium ${
                recommendation.liquidity === 'excellent' ? 'profit' :
                recommendation.liquidity === 'good' ? 'text-blue-400' :
                recommendation.liquidity === 'fair' ? 'text-yellow-400' :
                'loss'
              }`}>
                {recommendation.liquidity.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Expand hint */}
      <div className="mt-3 text-center">
        <span className="text-xs text-[var(--color-text-muted)]">
          {isExpanded ? '▲ Click to collapse' : '▼ Click for details'}
        </span>
      </div>
    </div>
  );
}

