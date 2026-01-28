import { Recommendation } from '../types';
import { generateSummary } from '../utils/algorithm';

interface SummaryProps {
  recommendations: Recommendation[];
}

export function Summary({ recommendations }: SummaryProps) {
  const summary = generateSummary(recommendations);

  if (recommendations.length === 0) {
    return (
      <div className="card p-6 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h3 className="text-lg font-semibold text-white mb-2">No Recommendations Yet</h3>
        <p className="text-[var(--color-text-muted)]">
          Add your positions and sold options above to get personalized recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-white mb-4">Summary</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Recommendations */}
        <div className="p-4 rounded-lg bg-[var(--color-bg)]">
          <div className="text-3xl font-bold text-white">{summary.totalRecommendations}</div>
          <div className="text-sm text-[var(--color-text-muted)]">Recommendations</div>
        </div>

        {/* Urgent Count */}
        {summary.urgentCount > 0 && (
          <div className="p-4 rounded-lg bg-[var(--color-bg)] border-l-4 border-[var(--color-danger)]">
            <div className="text-3xl font-bold text-[var(--color-danger)]">{summary.urgentCount}</div>
            <div className="text-sm text-[var(--color-text-muted)]">Urgent Actions</div>
          </div>
        )}

        {/* High Priority */}
        {summary.highCount > 0 && (
          <div className="p-4 rounded-lg bg-[var(--color-bg)] border-l-4 border-[var(--color-accent)]">
            <div className="text-3xl font-bold text-[var(--color-accent)]">{summary.highCount}</div>
            <div className="text-sm text-[var(--color-text-muted)]">High Priority</div>
          </div>
        )}

        {/* Potential Income */}
        {summary.potentialIncome > 0 && (
          <div className="p-4 rounded-lg bg-[var(--color-bg)] border-l-4 border-[var(--color-success)]">
            <div className="text-3xl font-bold profit">
              ${summary.potentialIncome.toFixed(0)}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Est. Income</div>
          </div>
        )}
      </div>

      {/* Strategy Breakdown */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="text-sm text-[var(--color-text-muted)] mb-2">By Strategy</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byStrategy).map(([strategy, count]) => (
            <span
              key={strategy}
              className="px-3 py-1 rounded-full bg-[var(--color-bg)] text-sm"
            >
              {strategy.replace(/_/g, ' ')}: <span className="font-bold text-white">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

