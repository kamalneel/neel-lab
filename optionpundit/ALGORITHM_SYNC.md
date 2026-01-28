# OptionPundit ← Agrawal Estate Planner Algorithm Sync

## Overview

This document tracks the synchronization status between OptionPundit's TypeScript algorithm implementation and the source Python implementation in Agrawal Estate Planner.

**Sync Direction:** One-way (Python → TypeScript)  
**Source Repository:** `agrawal-estate-planner/backend/app/modules/strategies/`

## Last Sync

| Property | Value |
|----------|-------|
| **Date** | 2026-01-06 |
| **Source Version** | V3.0 |
| **Synced By** | AI Assistant |

## File Mapping

| OptionPundit File | Source File (Agrawal Estate Planner) | Version | Status |
|-------------------|--------------------------------------|---------|--------|
| `src/algorithm/config.ts` | `algorithm_config.py` (V3 section) | V3.0 | ✅ Synced |
| `src/algorithm/calculations.ts` | `utils/option_calculations.py` | V3.0 | ✅ Synced |
| `src/algorithm/position-evaluator.ts` | `position_evaluator.py` | V3.0 | ✅ Synced |
| `src/algorithm/zero-cost-finder.ts` | `zero_cost_finder.py` | V3.0 | ✅ Synced |
| `src/algorithm/pull-back-detector.ts` | `pull_back_detector.py` | V3.0 | ✅ Synced |
| `src/algorithm/strike-selector.ts` | `technical_analysis.py` (partial) | V3.0 | ✅ Synced |
| `src/algorithm/types.ts` | `position_evaluator.py` (dataclasses) | V3.0 | ✅ Synced |

## Modifications from Source

The following modifications were made when porting from Python to TypeScript:

### 1. Removed Features
- **IRA Smart Assignment** - All accounts treated as investment accounts
- **Database dependencies** - No SQLAlchemy models, pure functions
- **Schwab API integration** - Uses Yahoo Finance instead
- **Scheduler/Scan system** - Client evaluates on-demand, not scheduled

### 2. Changed Logic
- **Cost-Neutral Rule**: Uses `debit ≤ 20% of NEW premium` instead of `20% of original premium`
  - Reason: Original premium not available from user input
- **Delta Calculation**: Estimated from strike distance + volatility (no real Greeks from API)
- **Market Data**: Async fetching from Yahoo Finance API

### 3. Added Features
- **Async/Promise-based**: All market data fetching is async
- **Client-side caching**: Quotes cached for 60 seconds
- **Error boundaries**: Graceful fallbacks when API unavailable

## How to Sync Updates

When Agrawal Estate Planner's algorithm is updated:

1. Review changes in the source Python files
2. Update corresponding TypeScript files in `src/algorithm/`
3. Update this document with new sync date
4. Update version numbers in file headers
5. Test thoroughly before deploying

## V3 Algorithm Summary

### Position States (Priority Order)

1. **PULL_BACK** - Far-dated position can return to shorter duration
2. **ROLL_ITM** - Position is ITM, find zero-cost escape (1-52 weeks)
3. **NEAR_ITM_WARNING** - OTM but ≤2% from strike, alert user
4. **ROLL_WEEKLY** - ≥60% profit captured, roll to next week
5. **NO_ACTION** - Hold current position

### Key Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Profit Threshold | 60% | Roll when this much profit captured |
| Cost-Neutral Max Debit | 20% of new premium | Maximum acceptable debit for rolls |
| Max Roll Duration | 52 weeks | Furthest we'll search for zero-cost roll |
| Near-ITM Threshold | 2% | Alert when OTM but within 2% of strike |
| Weekly Delta Target | 0.10 (Delta 10) | 90% probability OTM |
| ITM Escape Delta Target | 0.30 (Delta 30) | 70% probability OTM |

### Recommendation Types

| User Situation | Recommendation |
|----------------|----------------|
| Has shares, no option sold | "Sell covered call at $X strike" |
| Option sold, OTM, profitable | "Roll to next week" or "Watch" |
| Option sold, near-ITM (≤2%) | "⚠️ Roll to avoid assignment risk" |
| Option sold, ITM | "Roll to X weeks at $Y strike" |
| Option sold, deep ITM, no escape | "Close position (catastrophic)" |



