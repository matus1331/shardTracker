import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useShardData } from '../hooks/useShardData';
import { ShardCard } from './ShardCard';
import { UserMenu } from './UserMenu';
import { InstallBanner } from './InstallBanner';
import { EventsAdminModal } from './EventsAdminModal';

function LightningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Dashboard() {
  const { shards, error, logShards, correctCount, confirmDrop } = useShardData();
  const { user } = useAuth();
  const [showEventsAdmin, setShowEventsAdmin] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-12 sm:px-6 sm:py-8 sm:pb-16">
      <header className="mb-4 flex items-center justify-between gap-4 sm:mb-6 sm:items-start">
        <div>
          <h1 className="m-0 text-lg font-semibold sm:text-2xl">Shard tracker</h1>
          <p className="mt-1 hidden text-sm text-slate-400 sm:block">
            Sleduj mercy progress a aktuální šanci na drop
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => setShowEventsAdmin(true)}
              title="Spravovat 2x eventy"
              aria-label="Spravovat 2x eventy"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
            >
              <LightningIcon />
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      <InstallBanner />

      {error && <p className="text-sm text-red-400">Nepodařilo se načíst data: {error}</p>}

      {!shards && !error && <p className="text-sm text-slate-400">Načítání…</p>}

      {shards && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {shards.map((shard) => (
            <ShardCard
              key={shard.shardType}
              data={shard}
              onLog={logShards}
              onCorrect={correctCount}
              onConfirmDrop={confirmDrop}
            />
          ))}
        </div>
      )}

      {showEventsAdmin && <EventsAdminModal onClose={() => setShowEventsAdmin(false)} />}
    </div>
  );
}
