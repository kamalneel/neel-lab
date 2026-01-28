
export function Header() {
  return (
    <header className="py-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <img 
            src="/logo.png" 
            alt="OptionPundit Logo" 
            className="w-14 h-14 rounded-full shadow-lg ring-2 ring-[var(--color-accent)]/30"
          />
          
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Option<span className="text-[var(--color-accent)]">Pundit</span>
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your Options Strategy Advisor
            </p>
          </div>
        </div>

        {/* Right side - could add settings, help, etc */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-muted)] hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
        </div>
      </div>

      {/* Tagline */}
      <div className="mt-6 p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          <span className="text-[var(--color-accent)] font-medium">How it works:</span>{' '}
          Enter your stock positions and sold options below. OptionPundit will analyze your portfolio 
          and tell you exactly when and how to roll, close, or adjust your positions for maximum income.
        </p>
      </div>
    </header>
  );
}

