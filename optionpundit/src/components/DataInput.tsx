import React, { useState } from 'react';
import { Position, SoldOption } from '../types';
import { parseRobinhoodData, normalizeExpirationDate } from '../utils/robinhoodParser';

interface DataInputProps {
  positions: Position[];
  setPositions: (positions: Position[]) => void;
  soldOptions: SoldOption[];
  setSoldOptions: (options: SoldOption[]) => void;
}

// Generate simple ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function DataInput({
  positions,
  setPositions,
  soldOptions,
  setSoldOptions,
}: DataInputProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'positions' | 'options'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parseResult, setParseResult] = useState<{
    success: boolean;
    stocksCount: number;
    optionsCount: number;
    format: string;
    warnings: string[];
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Position form state
  const [newPosition, setNewPosition] = useState({
    symbol: '',
    shares: '',
    avgCost: '',
    currentPrice: '',
  });

  // Option form state
  const [newOption, setNewOption] = useState({
    symbol: '',
    optionType: 'call' as 'call' | 'put',
    strike: '',
    expiration: '',
    contracts: '1',
    premium: '',
    currentPremium: '',
  });

  const handlePaste = () => {
    if (!pasteText.trim()) return;

    setIsParsing(true);
    setParseResult(null);

    try {
      const result = parseRobinhoodData(pasteText);

      // Convert parsed stocks to positions
      const newPositions: Position[] = result.stocks.map(stock => ({
        id: generateId(),
        symbol: stock.symbol,
        shares: stock.shares,
        avgCost: stock.currentPrice, // Use current price as avg cost if not available
        currentPrice: stock.currentPrice,
      }));

      // Convert parsed options to sold options
      const newOptions: SoldOption[] = result.options.map(opt => ({
        id: generateId(),
        symbol: opt.symbol,
        optionType: opt.optionType,
        strike: opt.strikePrice,
        expiration: normalizeExpirationDate(opt.expirationDate || '') || '',
        contracts: opt.contracts,
        premium: opt.originalPremium || opt.currentPremium || 0,
        currentPremium: opt.currentPremium || undefined,
      })).filter(opt => opt.expiration); // Only include options with valid expiration

      // Merge with existing data (avoid duplicates by symbol+strike+expiration)
      const existingPositionSymbols = new Set(positions.map(p => p.symbol));
      const uniqueNewPositions = newPositions.filter(p => !existingPositionSymbols.has(p.symbol));

      const existingOptionKeys = new Set(
        soldOptions.map(o => `${o.symbol}-${o.strike}-${o.expiration}`)
      );
      const uniqueNewOptions = newOptions.filter(
        o => !existingOptionKeys.has(`${o.symbol}-${o.strike}-${o.expiration}`)
      );

      setPositions([...positions, ...uniqueNewPositions]);
      setSoldOptions([...soldOptions, ...uniqueNewOptions]);

      setParseResult({
        success: true,
        stocksCount: uniqueNewPositions.length,
        optionsCount: uniqueNewOptions.length,
        format: result.detectedFormat,
        warnings: result.warnings,
      });

      // Clear paste text after successful import
      if (uniqueNewPositions.length > 0 || uniqueNewOptions.length > 0) {
        setPasteText('');
      }
    } catch (error) {
      setParseResult({
        success: false,
        stocksCount: 0,
        optionsCount: 0,
        format: 'error',
        warnings: ['Failed to parse data. Please check the format.'],
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPosition.symbol || !newPosition.shares) return;

    const position: Position = {
      id: generateId(),
      symbol: newPosition.symbol.toUpperCase(),
      shares: parseInt(newPosition.shares),
      avgCost: parseFloat(newPosition.avgCost) || 0,
      currentPrice: newPosition.currentPrice ? parseFloat(newPosition.currentPrice) : undefined,
    };

    setPositions([...positions, position]);
    setNewPosition({ symbol: '', shares: '', avgCost: '', currentPrice: '' });
  };

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOption.symbol || !newOption.strike || !newOption.expiration || !newOption.premium) return;

    const option: SoldOption = {
      id: generateId(),
      symbol: newOption.symbol.toUpperCase(),
      optionType: newOption.optionType,
      strike: parseFloat(newOption.strike),
      expiration: newOption.expiration,
      contracts: parseInt(newOption.contracts) || 1,
      premium: parseFloat(newOption.premium),
      currentPremium: newOption.currentPremium ? parseFloat(newOption.currentPremium) : undefined,
    };

    setSoldOptions([...soldOptions, option]);
    setNewOption({
      symbol: '',
      optionType: 'call',
      strike: '',
      expiration: '',
      contracts: '1',
      premium: '',
      currentPremium: '',
    });
  };

  const handleDeletePosition = (id: string) => {
    setPositions(positions.filter(p => p.id !== id));
  };

  const handleDeleteOption = (id: string) => {
    setSoldOptions(soldOptions.filter(o => o.id !== id));
  };

  const handleClearAll = () => {
    if (confirm('Clear all data? This cannot be undone.')) {
      setPositions([]);
      setSoldOptions([]);
      setPasteText('');
      setParseResult(null);
    }
  };

  // Load sample data
  const handleLoadSample = () => {
    const samplePositions: Position[] = [
      { id: generateId(), symbol: 'AAPL', shares: 200, avgCost: 150, currentPrice: 175 },
      { id: generateId(), symbol: 'MSFT', shares: 100, avgCost: 280, currentPrice: 420 },
      { id: generateId(), symbol: 'NVDA', shares: 100, avgCost: 450, currentPrice: 480 },
      { id: generateId(), symbol: 'GOOGL', shares: 100, avgCost: 130, currentPrice: 175 },
    ];

    const today = new Date();
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
    const expirationStr = nextFriday.toISOString().split('T')[0];

    const sampleOptions: SoldOption[] = [
      { 
        id: generateId(), 
        symbol: 'AAPL', 
        optionType: 'call', 
        strike: 180, 
        expiration: expirationStr, 
        contracts: 1, 
        premium: 1.50, 
        currentPremium: 0.45
      },
      { 
        id: generateId(), 
        symbol: 'MSFT', 
        optionType: 'call', 
        strike: 415, 
        expiration: expirationStr, 
        contracts: 1, 
        premium: 2.00, 
        currentPremium: 4.50
      },
      { 
        id: generateId(), 
        symbol: 'NVDA', 
        optionType: 'call', 
        strike: 485, 
        expiration: expirationStr, 
        contracts: 1, 
        premium: 3.50, 
        currentPremium: 2.80
      },
    ];

    setPositions(samplePositions);
    setSoldOptions(sampleOptions);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Portfolio Data</h2>
        <div className="flex gap-2">
          <button
            onClick={handleLoadSample}
            className="btn-secondary text-sm"
          >
            Load Sample
          </button>
          <button
            onClick={handleClearAll}
            className="btn-secondary text-sm text-red-400 hover:text-red-300"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('paste')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'paste'
              ? 'bg-[var(--color-accent)] text-black'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          <span>📋</span> Paste from Robinhood
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'positions'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          Stock Positions ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('options')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'options'
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          Sold Options ({soldOptions.length})
        </button>
      </div>

      {/* Paste Tab */}
      {activeTab === 'paste' && (
        <div className="animate-fade-in">
          <div className="mb-4">
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Copy your positions from Robinhood and paste below. Supports stocks, options list, and option detail views.
            </p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`Paste your Robinhood data here...

Supported formats:
• Positions Held list (stocks and options)
• Option detail view (with Average credit)

Example:
AAPL $285 Call
12/5 · 1 sell
$2.84
+54.35%

AAPL
Apple Inc
200 Shares
$175.50`}
              className="w-full h-48 p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-white font-mono text-sm resize-none focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePaste}
              disabled={isParsing || !pasteText.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {isParsing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Parsing...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Import Data
                </>
              )}
            </button>
          </div>

          {/* Parse Result */}
          {parseResult && (
            <div className={`mt-4 p-4 rounded-lg border ${
              parseResult.success 
                ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              {parseResult.success ? (
                <div>
                  <div className="flex items-center gap-2 text-[var(--color-accent)] font-medium mb-2">
                    <span>✓</span>
                    Imported successfully!
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    Detected format: <strong className="text-white">{parseResult.format}</strong>
                    <span className="mx-2">•</span>
                    {parseResult.stocksCount > 0 && (
                      <span className="mr-3">{parseResult.stocksCount} stocks</span>
                    )}
                    {parseResult.optionsCount > 0 && (
                      <span>{parseResult.optionsCount} options</span>
                    )}
                    {parseResult.stocksCount === 0 && parseResult.optionsCount === 0 && (
                      <span>No new data (duplicates skipped)</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-red-400">
                  <span>✕</span> {parseResult.warnings[0]}
                </div>
              )}
            </div>
          )}

          {/* Quick Stats */}
          {(positions.length > 0 || soldOptions.length > 0) && (
            <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
              <div className="text-sm text-[var(--color-text-muted)]">
                <strong className="text-white">Current Portfolio:</strong>
                <span className="ml-3">{positions.length} stock positions</span>
                <span className="mx-2">•</span>
                <span>{soldOptions.length} sold options</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="animate-fade-in">
          <form onSubmit={handleAddPosition} className="grid grid-cols-5 gap-3 mb-4">
            <input
              type="text"
              placeholder="Symbol"
              value={newPosition.symbol}
              onChange={e => setNewPosition({ ...newPosition, symbol: e.target.value })}
              className="uppercase"
            />
            <input
              type="number"
              placeholder="Shares"
              value={newPosition.shares}
              onChange={e => setNewPosition({ ...newPosition, shares: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Avg Cost"
              value={newPosition.avgCost}
              onChange={e => setNewPosition({ ...newPosition, avgCost: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Current Price"
              value={newPosition.currentPrice}
              onChange={e => setNewPosition({ ...newPosition, currentPrice: e.target.value })}
            />
            <button type="submit" className="btn-primary">
              Add
            </button>
          </form>

          {positions.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              No positions yet. Add your stock holdings above or paste from Robinhood.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Shares</th>
                  <th>Avg Cost</th>
                  <th>Current Price</th>
                  <th>Contracts Available</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => (
                  <tr key={pos.id}>
                    <td className="font-bold text-white">{pos.symbol}</td>
                    <td>{pos.shares}</td>
                    <td>${pos.avgCost.toFixed(2)}</td>
                    <td>{pos.currentPrice ? `$${pos.currentPrice.toFixed(2)}` : '-'}</td>
                    <td>{Math.floor(pos.shares / 100)}</td>
                    <td>
                      <button
                        onClick={() => handleDeletePosition(pos.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Options Tab */}
      {activeTab === 'options' && (
        <div className="animate-fade-in">
          <form onSubmit={handleAddOption} className="grid grid-cols-8 gap-3 mb-4">
            <input
              type="text"
              placeholder="Symbol"
              value={newOption.symbol}
              onChange={e => setNewOption({ ...newOption, symbol: e.target.value })}
              className="uppercase"
            />
            <select
              value={newOption.optionType}
              onChange={e => setNewOption({ ...newOption, optionType: e.target.value as 'call' | 'put' })}
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
            <input
              type="number"
              step="0.5"
              placeholder="Strike"
              value={newOption.strike}
              onChange={e => setNewOption({ ...newOption, strike: e.target.value })}
            />
            <input
              type="date"
              value={newOption.expiration}
              onChange={e => setNewOption({ ...newOption, expiration: e.target.value })}
            />
            <input
              type="number"
              placeholder="Contracts"
              value={newOption.contracts}
              onChange={e => setNewOption({ ...newOption, contracts: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Premium Sold"
              value={newOption.premium}
              onChange={e => setNewOption({ ...newOption, premium: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Current Premium"
              value={newOption.currentPremium}
              onChange={e => setNewOption({ ...newOption, currentPremium: e.target.value })}
            />
            <button type="submit" className="btn-primary">
              Add
            </button>
          </form>

          {soldOptions.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              No options yet. Add your sold options above or paste from Robinhood.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Strike</th>
                  <th>Expiration</th>
                  <th>Contracts</th>
                  <th>Premium Sold</th>
                  <th>Current</th>
                  <th>P/L</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {soldOptions.map(opt => {
                  const currentPrem = opt.currentPremium ?? opt.premium * 0.5;
                  const profitPct = ((opt.premium - currentPrem) / opt.premium) * 100;
                  const isProfit = profitPct > 0;
                  
                  return (
                    <tr key={opt.id}>
                      <td className="font-bold text-white">{opt.symbol}</td>
                      <td className="capitalize">{opt.optionType}</td>
                      <td>${opt.strike.toFixed(2)}</td>
                      <td>{new Date(opt.expiration + 'T00:00:00').toLocaleDateString()}</td>
                      <td>{opt.contracts}</td>
                      <td>${opt.premium.toFixed(2)}</td>
                      <td>{opt.currentPremium ? `$${opt.currentPremium.toFixed(2)}` : '-'}</td>
                      <td className={isProfit ? 'profit' : 'loss'}>
                        {profitPct.toFixed(0)}%
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteOption(opt.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
