/**
 * Robinhood Paste Parser
 * 
 * Parses copy-pasted data from Robinhood app, supporting:
 * 1. Stock holdings
 * 2. Options list view (Positions Held)
 * 3. Options detail view (with Average credit)
 * 4. Mixed format (both stocks and options)
 */

export interface ParsedStock {
  symbol: string;
  name: string;
  shares: number;
  marketValue: number;
  currentPrice: number;
}

export interface ParsedOption {
  symbol: string;
  strikePrice: number;
  optionType: 'call' | 'put';
  expirationDate: string | null;
  contracts: number;
  currentPremium: number | null;
  originalPremium: number | null;
  gainLossPercent: number | null;
}

export interface ParseResult {
  stocks: ParsedStock[];
  options: ParsedOption[];
  detectedFormat: string;
  warnings: string[];
  hasOptionsSection: boolean;
  hasStocksSection: boolean;
}

type FormatType = 'stocks' | 'options_list' | 'options_detail' | 'mixed' | 'unknown';

/**
 * Detect what format the pasted text is in.
 */
function detectFormat(text: string): FormatType {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);

  // Options detail view indicators
  if (lines.some(l => l.includes('Average credit'))) {
    return 'options_detail';
  }
  if (lines.some(l => l.includes('Total return'))) {
    return 'options_detail';
  }
  if (lines.some(l => l.includes('Contracts') && l.includes('-'))) {
    return 'options_detail';
  }

  // Check for explicit section headers
  const hasOptionsHeader = lines.some(l => /^Options$/i.test(l));
  const hasStocksHeader = lines.some(l => /^Stocks?$/i.test(l));

  // Options list indicators
  const hasOptionPattern = lines.some(l => /^[A-Z]+\s+\$[\d.]+\s+(Call|Put)$/i.test(l));
  const hasSells = lines.some(l => /\d+\s+sells?/i.test(l));

  // Stock indicators
  const hasShares = lines.some(l => /[\d,.]+\s+shares?/i.test(l));

  // If both section headers are present, treat as mixed format
  if (hasOptionsHeader && hasStocksHeader) {
    return 'mixed';
  }

  if (hasOptionsHeader && !hasStocksHeader) {
    return 'options_list';
  }

  if (hasStocksHeader && !hasOptionsHeader) {
    return 'stocks';
  }

  // Positions Held header
  if (lines.some(l => l.includes('Positions Held'))) {
    if (hasOptionPattern || hasSells) {
      if (hasShares) return 'mixed';
      return 'options_list';
    }
    if (hasShares) return 'stocks';
  }

  if (hasOptionPattern || hasSells) {
    if (hasShares) return 'mixed';
    return 'options_list';
  }

  if (hasShares) return 'stocks';

  return 'unknown';
}

/**
 * Check if a line is in an options context
 */
function isOptionContext(lines: string[], index: number): boolean {
  if (index + 1 < lines.length) {
    const nextLine = lines[index + 1];
    if (/\d+\s+sells?/i.test(nextLine)) return true;
    if (/^\d{1,2}\/\d{1,2}/.test(nextLine)) return true;
  }
  return false;
}

/**
 * Check if a line looks like a company name
 */
function isCompanyName(line: string): boolean {
  if (/^[A-Z]{1,5}$/.test(line)) return false;
  if (line.includes('Shares') || line.includes('$') || line.includes('%')) return false;
  if (line.includes('Today') || line.toLowerCase().includes('sell')) return false;
  return true;
}

/**
 * Parse stock holdings from Robinhood paste
 */
function parseStockHoldings(text: string): ParsedStock[] {
  const holdings: ParsedStock[] = [];
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Look for a stock symbol line (all uppercase, 1-5 letters)
    // But NOT option patterns like "AAPL $285 Call"
    const symbolMatch = line.match(/^([A-Z]{1,5})$/);

    if (symbolMatch && !isOptionContext(lines, i)) {
      const symbol = symbolMatch[1];

      const holding: ParsedStock = {
        symbol,
        name: symbol,
        shares: 0,
        marketValue: 0,
        currentPrice: 0,
      };

      let seenShares = false;
      let pricePerShare = 0;

      // Look ahead for name, shares, and price
      let j = i + 1;
      while (j < Math.min(i + 6, lines.length)) {
        const nextLine = lines[j];

        // Check for shares - handles "1,700 Shares" and "1.56K shares"
        const sharesMatch = nextLine.match(/^([\d,]+\.?\d*)\s*(K)?\s*Shares?$/i);
        if (sharesMatch) {
          let sharesValue = parseFloat(sharesMatch[1].replace(',', ''));
          if (sharesMatch[2]?.toUpperCase() === 'K') {
            sharesValue *= 1000;
          }
          holding.shares = sharesValue;
          seenShares = true;
          j++;
          continue;
        }

        // Check for dollar amount (price per share)
        if (!nextLine.startsWith('+') && !nextLine.startsWith('-') && !nextLine.startsWith('−')) {
          const valueMatch = nextLine.match(/^\$?([\d,]+\.?\d*)$/);
          if (valueMatch) {
            const dollarAmount = parseFloat(valueMatch[1].replace(',', ''));

            if (seenShares && holding.shares > 0) {
              pricePerShare = dollarAmount;
              holding.currentPrice = dollarAmount;
              holding.marketValue = Math.round(holding.shares * dollarAmount * 100) / 100;
            } else {
              pricePerShare = dollarAmount;
            }
            j++;
            continue;
          }
        }

        // Check for company name
        if (isCompanyName(nextLine) && !/^[A-Z]{1,5}$/.test(nextLine)) {
          holding.name = nextLine;
          j++;
          continue;
        }

        // Skip daily change lines
        if (nextLine.includes('Today') || nextLine.startsWith('+') || nextLine.startsWith('-') || nextLine.startsWith('−')) {
          j++;
          continue;
        }

        // If we hit another symbol, stop
        if (/^[A-Z]{1,5}$/.test(nextLine)) {
          break;
        }

        j++;
      }

      // Handle deferred calculation
      if (holding.shares > 0 && pricePerShare > 0 && holding.marketValue === 0) {
        holding.currentPrice = pricePerShare;
        holding.marketValue = Math.round(holding.shares * pricePerShare * 100) / 100;
      }

      if (holding.shares > 0 || holding.marketValue > 0) {
        holdings.push(holding);
        i = j;
        continue;
      }
    }

    i++;
  }

  return holdings;
}

/**
 * Calculate original premium from current premium and gain/loss percentage
 */
function calculateOriginalPremium(currentPremium: number, gainLossPercent: number): number | null {
  if (gainLossPercent === 100) return null;

  try {
    const original = currentPremium / (1 - gainLossPercent / 100);
    if (original < 0) return null;
    return Math.round(original * 10000) / 10000;
  } catch {
    return null;
  }
}

/**
 * Parse options from list view format
 */
function parseOptionsListView(text: string): ParsedOption[] {
  const options: ParsedOption[] = [];
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);

  // Skip "Pending Orders" section
  let startIndex = 0;
  let inPendingSection = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (/^Pending\s*Orders?$/i.test(line)) {
      inPendingSection = true;
      continue;
    }
    if (/^Positions?\s*Held$/i.test(line)) {
      inPendingSection = false;
      startIndex = idx + 1;
      break;
    }
  }

  if (inPendingSection) return [];

  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];

    // Look for: SYMBOL $PRICE Call/Put
    const optionMatch = line.match(/^([A-Z]+)\s+\$?([\d.]+)\s+(Call|Put)$/i);

    if (optionMatch) {
      const symbol = optionMatch[1].toUpperCase();
      const strikePrice = parseFloat(optionMatch[2]);
      const optionType = optionMatch[3].toLowerCase() as 'call' | 'put';

      const option: ParsedOption = {
        symbol,
        strikePrice,
        optionType,
        expirationDate: null,
        contracts: 1,
        currentPremium: null,
        originalPremium: null,
        gainLossPercent: null,
      };

      // Look for expiration and contracts: "12/5 · 15 sells"
      if (i + 1 < lines.length) {
        const dateLine = lines[i + 1];

        // Check if this is a pending order (buy to close) - skip
        if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*[·•]\s*\d+\s*buys?\s+to\s+close$/i.test(dateLine)) {
          i++;
          continue;
        }

        // Check for actual position (sells)
        const dateMatch = dateLine.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*[·•]\s*(\d+)\s*sells?$/i);
        if (dateMatch) {
          option.expirationDate = dateMatch[1];
          option.contracts = parseInt(dateMatch[2]);
          i++;
        }
      }

      // Next line could be current premium or dollar return
      let dollarReturnValue: number | null = null;

      if (i + 1 < lines.length) {
        const valueLine = lines[i + 1];

        // Check for "Last Price" mode: simple price like "$0.14"
        const premiumMatch = valueLine.match(/^\$?([\d.]+)$/);

        // Check for "Total Return" mode: "+$1,666.00" or "-$500.00"
        const dollarReturnMatch = valueLine.match(/^([+-])\$?([\d,]+\.?\d*)$/);

        if (premiumMatch && !valueLine.startsWith('+') && !valueLine.startsWith('-')) {
          option.currentPremium = parseFloat(premiumMatch[1]);
          i++;
        } else if (dollarReturnMatch) {
          const sign = dollarReturnMatch[1] === '+' ? 1 : -1;
          const amountStr = dollarReturnMatch[2].replace(',', '');
          dollarReturnValue = sign * parseFloat(amountStr);
          i++;
        }
      }

      // Look for gain/loss percentage: "+54.35%" or "-28.85%"
      if (i + 1 < lines.length) {
        const glLine = lines[i + 1];
        const glMatch = glLine.match(/^([+-]?[\d.]+)%$/);
        if (glMatch) {
          option.gainLossPercent = parseFloat(glMatch[1]);
          i++;
        }
      }

      // Calculate original premium
      if (option.currentPremium !== null && option.gainLossPercent !== null) {
        option.originalPremium = calculateOriginalPremium(option.currentPremium, option.gainLossPercent);
      } else if (dollarReturnValue !== null && option.gainLossPercent !== null && option.contracts > 0) {
        if (option.gainLossPercent !== 0) {
          const original = dollarReturnValue / (option.gainLossPercent / 100 * option.contracts * 100);
          if (original > 0) {
            option.originalPremium = Math.round(original * 10000) / 10000;
            option.currentPremium = Math.round(original * (1 - option.gainLossPercent / 100) * 10000) / 10000;
          }
        }
      }

      // Only add options with expiration date
      if (option.expirationDate) {
        options.push(option);
      }
    }

    i++;
  }

  return options;
}

/**
 * Parse options from detail view format
 */
function parseOptionsDetailView(text: string): ParsedOption | null {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);

  const option: ParsedOption = {
    symbol: '',
    strikePrice: 0,
    optionType: 'call',
    expirationDate: null,
    contracts: 1,
    currentPremium: null,
    originalPremium: null,
    gainLossPercent: null,
  };

  for (const line of lines) {
    // Symbol and strike from header
    const symbolMatch = line.match(/^([A-Z]+)\s+\$?([\d.]+)\s+(Call|Put)/i);
    if (symbolMatch) {
      option.symbol = symbolMatch[1].toUpperCase();
      option.strikePrice = parseFloat(symbolMatch[2]);
      option.optionType = symbolMatch[3].toLowerCase() as 'call' | 'put';
      continue;
    }

    // Current price
    const currentMatch = line.match(/^Current\s+price\s+\$?([\d.]+)$/i);
    if (currentMatch) {
      option.currentPremium = parseFloat(currentMatch[1]);
      continue;
    }

    // Average credit (original premium)
    const creditMatch = line.match(/^Average\s+credit\s+\$?([\d.]+)$/i);
    if (creditMatch) {
      option.originalPremium = parseFloat(creditMatch[1]);
      continue;
    }

    // Contracts
    const contractsMatch = line.match(/^Contracts\s+(-?\d+)$/i);
    if (contractsMatch) {
      option.contracts = Math.abs(parseInt(contractsMatch[1]));
      continue;
    }

    // Expiration date
    const expMatch = line.match(/^Expiration\s+date\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/i);
    if (expMatch) {
      option.expirationDate = expMatch[1];
      continue;
    }

    // Total return with percentage
    const returnMatch = line.match(/Total\s+return.*\(\+?([-\d.]+)%\)/i);
    if (returnMatch) {
      option.gainLossPercent = parseFloat(returnMatch[1]);
      continue;
    }
  }

  if (option.symbol && (option.originalPremium || option.currentPremium)) {
    return option;
  }

  return null;
}

/**
 * Normalize expiration date to YYYY-MM-DD format
 */
export function normalizeExpirationDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    const parts = dateStr.split('/');
    const today = new Date();

    if (parts.length === 2) {
      // MM/DD format - assume current or next year
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);

      let year = today.getFullYear();
      const testDate = new Date(year, month - 1, day);

      // If date is more than 30 days in the past, assume next year
      const diffDays = (today.getTime() - testDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 30) {
        year++;
      }

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    if (parts.length === 3) {
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // Handle 2-digit year
      if (year < 100) {
        year += 2000;
      }

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Main entry point for parsing Robinhood data
 */
export function parseRobinhoodData(text: string): ParseResult {
  const result: ParseResult = {
    stocks: [],
    options: [],
    detectedFormat: 'unknown',
    warnings: [],
    hasOptionsSection: false,
    hasStocksSection: false,
  };

  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
  result.hasOptionsSection = lines.some(l => /^Options$/i.test(l));
  result.hasStocksSection = lines.some(l => /^Stocks?$/i.test(l));

  const detected = detectFormat(text);
  result.detectedFormat = detected;

  if (detected === 'options_detail') {
    const option = parseOptionsDetailView(text);
    if (option) {
      result.options.push(option);
    }
  } else if (detected === 'options_list') {
    result.options = parseOptionsListView(text);
  } else if (detected === 'stocks') {
    result.stocks = parseStockHoldings(text);
  } else if (detected === 'mixed') {
    result.stocks = parseStockHoldings(text);
    result.options = parseOptionsListView(text);
  } else {
    result.warnings.push('Could not detect data format. Please ensure you copied from Robinhood.');
  }

  return result;
}

