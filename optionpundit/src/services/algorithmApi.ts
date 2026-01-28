/**
 * Algorithm API Client
 *
 * This service handles communication with the versioned algorithm endpoints.
 * Supports V3 (current) and will support V4+ in the future.
 */

import { Position, SoldOption, Recommendation } from '../types';

export type AlgorithmVersion = 'v3' | 'v4';

export interface EvaluateRequest {
  positions: Position[];
  soldOptions: SoldOption[];
}

export interface EvaluateResponse {
  version: string;
  recommendations: Recommendation[];
  summary: {
    total: number;
    urgent: number;
    high: number;
    medium: number;
    low: number;
    byAction: Record<string, number>;
  };
  quotesUsed: Record<string, number>;
}

export interface ApiError {
  error: string;
  message?: string;
}

// API base URL - empty for same-origin, can be configured for different environments
const API_BASE = '';

/**
 * Evaluate positions and sold options using the specified algorithm version
 */
export async function evaluatePositions(
  positions: Position[],
  soldOptions: SoldOption[],
  version: AlgorithmVersion = 'v3'
): Promise<EvaluateResponse> {
  const url = `${API_BASE}/api/optionpundit/${version}/evaluate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ positions, soldOptions }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as ApiError;
    throw new Error(errorData.message || errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if the API is available
 */
export async function checkApiHealth(version: AlgorithmVersion = 'v3'): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/${version}/evaluate`, {
      method: 'OPTIONS',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the default algorithm version
 */
export function getDefaultVersion(): AlgorithmVersion {
  // Check localStorage for saved preference
  const saved = localStorage.getItem('optionpundit-algorithm-version');
  if (saved === 'v3' || saved === 'v4') {
    return saved;
  }
  return 'v3';
}

/**
 * Save the preferred algorithm version
 */
export function saveVersion(version: AlgorithmVersion): void {
  localStorage.setItem('optionpundit-algorithm-version', version);
}

/**
 * Get available algorithm versions with descriptions
 */
export function getAvailableVersions(): Array<{
  version: AlgorithmVersion;
  name: string;
  description: string;
  isDefault: boolean;
}> {
  return [
    {
      version: 'v3',
      name: 'V3.3',
      description: 'Current stable: Unified evaluator with COMPRESS & MONITOR actions',
      isDefault: true,
    },
    {
      version: 'v4',
      name: 'V4',
      description: 'Coming soon: Intrinsic value model, 4-week escape cap',
      isDefault: false,
    },
  ];
}
