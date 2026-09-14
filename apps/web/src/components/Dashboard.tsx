import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { useAuth } from '../auth/AuthContext';
import { useShardData } from '../hooks/useShardData';
import { ShardCard } from './ShardCard';
import { UserMenu } from './UserMenu';
import { InstallBanner } from './InstallBanner';
import { EventsAdminPanel } from './EventsAdminPanel';
import { HistoryStatsPanel } from './HistoryStatsPanel';
import { AppTabs } from './AppTabs';
import ClassicLoader from './ui/loader';

function GemIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9h18L12 22 3 9Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2h8l3.5 5.5-7.5 2.5-7.5-2.5L8 2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12a9 9 0 1 0 3-6.7M3 12V6m0 6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Display order only (not SHARD_TYPES — that stays canonical for seeding/API/filters
 * elsewhere): classic shards first, Primal's dual-track card gets its own full-width row,
 * Remnant (a "summon", not a shard) is set apart at the very end. */
const DASHBOARD_ORDER: ShardType[] = ['ANCIENT', 'VOID', 'SACRED', 'PRIMAL', 'REMNANT'];

type TabKey = 'shards' | 'stats' | 'history' | 'events';

export function Dashboard() {
  const { shards, error, logShards, correctCount, confirmDrop } = useShardData();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('shards');

  if (!shards && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ClassicLoader />
      </div>
    );
  }

  const tabs = [
    { key: 'shards', label: 'Shardy', icon: GemIcon },
    { key: 'stats', label: 'Statistiky', icon: ChartIcon },
    { key: 'history', label: 'Historie', icon: HistoryIcon },
    ...(user?.isAdmin ? [{ key: 'events', label: 'Nastavení eventů', icon: LightningIcon }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-12 sm:px-6 sm:py-8 sm:pb-16">
      <header className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        <div>
          <h1 className="m-0 text-lg font-semibold sm:text-2xl">Shard tracker</h1>
          <p className="mt-1 hidden text-sm text-slate-400 sm:block">
            Sleduj mercy progress a aktuální šanci na drop
          </p>
        </div>
        <UserMenu />
      </header>

      <AppTabs tabs={tabs} active={tab} onChange={(key) => setTab(key as TabKey)} />

      {tab === 'shards' && (
        <>
          <InstallBanner />

          {error && <p className="text-sm text-red-400">Nepodařilo se načíst data: {error}</p>}

          {shards && (
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] sm:gap-4">
              {/* Ancient/Void/Sacred are the classic single-track shards and share the regular
                  grid. Primal carries two mercy tracks and is taller than the rest, so it gets its
                  own full-width row (avoids the row-height mismatch that stretched/gapped
                  neighbors). Remnant is a "summon", not a shard — kept apart at the end, centered,
                  rather than folded back into the shard grid. */}
              {[...shards]
                .sort((a, b) => DASHBOARD_ORDER.indexOf(a.shardType) - DASHBOARD_ORDER.indexOf(b.shardType))
                .map((shard) => {
                  if (shard.shardType === 'PRIMAL') {
                    return (
                      <div key={shard.shardType} className="sm:col-span-full">
                        <ShardCard data={shard} onLog={logShards} onCorrect={correctCount} onConfirmDrop={confirmDrop} />
                      </div>
                    );
                  }
                  if (shard.shardType === 'REMNANT') {
                    return (
                      <div key={shard.shardType} className="sm:col-span-full sm:flex sm:justify-center">
                        <div className="w-full sm:max-w-xs">
                          <ShardCard data={shard} onLog={logShards} onCorrect={correctCount} onConfirmDrop={confirmDrop} />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <ShardCard
                      key={shard.shardType}
                      data={shard}
                      onLog={logShards}
                      onCorrect={correctCount}
                      onConfirmDrop={confirmDrop}
                    />
                  );
                })}
            </div>
          )}
        </>
      )}

      {(tab === 'stats' || tab === 'history') && <HistoryStatsPanel tab={tab} />}

      {tab === 'events' && user?.isAdmin && <EventsAdminPanel />}
    </div>
  );
}
