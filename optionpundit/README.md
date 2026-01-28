# OptionPundit 📊

Your Options Strategy Advisor - A standalone web application that analyzes your options positions and provides actionable recommendations based on the V2 Options Notification Algorithm.

## Features

- **📈 Portfolio Input**: Enter your stock positions and sold options
- **🧠 Smart Analysis**: V2 algorithm analyzes your positions for:
  - Early roll opportunities (60%+ profit captured)
  - ITM positions that need rolling
  - Positions approaching strike price
  - Unsold contracts (missed income potential)
- **📋 Actionable Recommendations**: Get specific guidance on what to do with each position
- **💾 Local Storage**: Your data is saved in your browser (no server needed)

## Algorithms

Based on the V2 Options Notification Algorithm:

### Early Roll (Scenario A)
- Triggers when option has captured ≥60% of original premium
- Recommends rolling to next week with Delta 10 strike

### ITM Roll (Scenario C)
- Triggers when stock price exceeds strike price
- Analyzes optimal roll strategies with cost analysis

### Preemptive Roll (Scenario D)
- Triggers when stock is within 3% of strike
- Alerts before position goes ITM

### Sell Unsold Contracts
- Identifies shares that could be generating covered call income

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- LocalStorage for data persistence

## Usage

1. **Add Positions**: Enter your stock holdings (symbol, shares, cost, current price)
2. **Add Options**: Enter your sold options (symbol, strike, expiration, premium)
3. **Review Recommendations**: The algorithm analyzes your data and provides recommendations
4. **Take Action**: Follow the execution steps provided for each recommendation

## Configuration

The algorithm uses these default thresholds (can be customized):

| Parameter | Default | Description |
|-----------|---------|-------------|
| Normal Profit Threshold | 60% | Early roll trigger |
| Earnings Week Threshold | 45% | More aggressive during earnings |
| Short DTE Threshold | 35% | For positions expiring in ≤3 days |
| Max Debit % | 50% | Maximum debit as % of new premium |
| Approaching Threshold | 3% | Preemptive roll alert distance |

## Disclaimer

This tool provides educational guidance only. Always do your own research before trading. Options trading involves substantial risk and is not suitable for all investors.

## License

MIT
