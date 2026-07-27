import { useState } from 'react';
import { useHistoryData } from '../hooks/useHistoryData';
import { StatsTab } from './StatsTab';
import { HistoryTab } from './HistoryTab';

interface HistoryStatsPageProps {
  onBack: () => void;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Tab = 'stats' | 'history';

export function HistoryStatsPage({ onBack }: HistoryStatsPageProps) {
  const [tab, setTab] = useState<Tab>('stats');
  const { drops, counters, error } = useHistoryData();

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-12 sm:px-6 sm:py-8 sm:pb-16">
      <header className="mb-4 flex items-center gap-3 sm:mb-6">
        <button
          type="button"
          onClick={onBack}
          title="Zpět na přehled"
          aria-label="Zpět na přehled"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <BackIcon />
        </button>
        <h1 className="m-0 text-lg font-semibold sm:text-2xl">Historie a statistiky</h1>
      </header>

      <div className="mb-4 flex gap-2">
        {(
          [
            { key: 'stats', label: 'Statistiky' },
            { key: 'history', label: 'Historie' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-slate-100 text-slate-900'
                : 'border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">Nepodařilo se načíst data: {error}</p>}
      {(!drops || !counters) && !error && <p className="text-sm text-slate-400">Načítání…</p>}

      {drops &&
        counters &&
        (tab === 'stats' ? <StatsTab drops={drops} counters={counters} /> : <HistoryTab drops={drops} />)}
    </div>
  );
}
