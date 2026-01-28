import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DataInput } from '../components/DataInput';
import { RecommendationCard } from '../components/RecommendationCard';
import { Summary } from '../components/Summary';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Position, SoldOption, Recommendation } from '../types';
import {
  evaluatePositions,
  AlgorithmVersion,
  getDefaultVersion,
  saveVersion,
  getAvailableVersions,
  EvaluateResponse,
} from '../services/algorithmApi';
// Fallback to local algorithm if API fails
import { generateRecommendations } from '../utils/algorithm';
import { DEFAULT_CONFIG } from '../types';

export function OptionPunditPage() {
  useEffect(() => {
    document.title = "OptionPundit - Your Options Strategy Advisor";
  }, []);

  // Persist data in localStorage
  const [positions, setPositions] = useLocalStorage<Position[]>('optionpundit-positions', []);
  const [soldOptions, setSoldOptions] = useLocalStorage<SoldOption[]>('optionpundit-options', []);

  // Algorithm state
  const [algorithmVersion, setAlgorithmVersion] = useState<AlgorithmVersion>(getDefaultVersion);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<EvaluateResponse | null>(null);
  const [useLocalFallback, setUseLocalFallback] = useState(false);

  // Available versions
  const versions = getAvailableVersions();

  // Handle version change
  const handleVersionChange = (version: AlgorithmVersion) => {
    setAlgorithmVersion(version);
    saveVersion(version);
  };

  // Evaluate positions using API or local fallback
  const evaluate = useCallback(async () => {
    if (positions.length === 0 && soldOptions.length === 0) {
      setRecommendations([]);
      setApiResponse(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try API first
      const response = await evaluatePositions(positions, soldOptions, algorithmVersion);
      setRecommendations(response.recommendations);
      setApiResponse(response);
      setUseLocalFallback(false);
      console.log(`[${algorithmVersion.toUpperCase()}] API Response:`, response);
    } catch (apiError) {
      console.warn('API call failed, using local fallback:', apiError);

      // Fallback to local algorithm
      try {
        const localRecs = generateRecommendations(positions, soldOptions, DEFAULT_CONFIG);
        setRecommendations(localRecs);
        setApiResponse(null);
        setUseLocalFallback(true);
        console.log('[LOCAL] Fallback recommendations:', localRecs);
      } catch (localError) {
        setError('Failed to generate recommendations. Please try again.');
        console.error('Local algorithm error:', localError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [positions, soldOptions, algorithmVersion]);

  // Re-evaluate when data or version changes
  useEffect(() => {
    evaluate();
  }, [evaluate]);

  return (
    <div className="min-h-screen bg-gradient-main">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with back navigation */}
        <header className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors mb-6"
          >
            <span>←</span>
            <span className="text-sm">Back to Neel's Lab</span>
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl shadow-glow">
                📊
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">OptionPundit</h1>
                <p className="text-[var(--color-text-secondary)]">Your Options Strategy Advisor</p>
              </div>
            </div>

            {/* Version Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-muted)]">Algorithm:</span>
              <div className="flex rounded-lg bg-[var(--color-bg-secondary)] p-1">
                {versions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => handleVersionChange(v.version)}
                    disabled={v.version === 'v4'} // V4 not ready yet
                    className={`
                      px-3 py-1.5 rounded-md text-sm font-medium transition-all
                      ${algorithmVersion === v.version
                        ? 'bg-[var(--color-accent)] text-black'
                        : v.version === 'v4'
                          ? 'text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
                          : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-tertiary)]'
                      }
                    `}
                    title={v.description}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Data Input Section */}
        <section className="mb-8">
          <DataInput
            positions={positions}
            setPositions={setPositions}
            soldOptions={soldOptions}
            setSoldOptions={setSoldOptions}
          />
        </section>

        {/* API Status Banner */}
        {useLocalFallback && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-900/30 border border-yellow-600/30 text-yellow-200 text-sm">
            <span className="font-medium">⚠️ Using local algorithm.</span>
            {' '}API unavailable - running V2 fallback locally.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-600/30 text-red-200 text-sm">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {/* Summary Section */}
        <section className="mb-8">
          <Summary recommendations={recommendations} />

          {/* API Response Info */}
          {apiResponse && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">
                  Algorithm: <span className="text-[var(--color-accent)] font-medium">V{apiResponse.version}</span>
                </span>
                <span className="text-[var(--color-text-muted)]">
                  Quotes: {Object.keys(apiResponse.quotesUsed).length} symbols
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Recommendations Section */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📋</span> Recommendations
            {recommendations.length > 0 && (
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                ({recommendations.length})
              </span>
            )}
            {isLoading && (
              <span className="ml-2 text-sm font-normal text-[var(--color-accent)] animate-pulse">
                Loading...
              </span>
            )}
          </h2>

          {isLoading ? (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-4 animate-bounce">⏳</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Analyzing Positions...
              </h3>
              <p className="text-[var(--color-text-muted)]">
                Fetching market data and running {algorithmVersion.toUpperCase()} algorithm
              </p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No Recommendations
              </h3>
              <p className="text-[var(--color-text-muted)] max-w-md mx-auto">
                Add your stock positions and sold options above. OptionPundit will analyze your
                portfolio and provide actionable recommendations.
              </p>
              <div className="mt-6 p-4 rounded-lg bg-[var(--color-bg)] text-left max-w-md mx-auto">
                <div className="text-sm font-medium text-[var(--color-accent)] mb-2">
                  The {algorithmVersion.toUpperCase()} algorithm checks for:
                </div>
                <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
                  <li>✓ Pull-back opportunities (far-dated OTM → shorter)</li>
                  <li>✓ ITM positions that need rolling or compression</li>
                  <li>✓ Near-ITM warnings (approaching strike)</li>
                  <li>✓ Profitable positions ready for weekly roll</li>
                  <li>✓ Unsold contracts (missed income)</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={rec.id || index}>
                  <RecommendationCard recommendation={rec} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            <span className="text-white font-medium">OptionPundit</span> — Your Options Strategy Advisor
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Using {apiResponse ? `V${apiResponse.version}` : algorithmVersion.toUpperCase()} Algorithm
            {useLocalFallback && ' (Local Fallback)'}.
            This tool provides educational guidance only. Always do your own research before trading.
          </p>
        </footer>
      </div>
    </div>
  );
}
