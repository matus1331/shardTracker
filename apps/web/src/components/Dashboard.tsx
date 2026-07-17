import { useShardData } from '../hooks/useShardData';
import { ShardCard } from './ShardCard';
import { UserMenu } from './UserMenu';
import { InstallBanner } from './InstallBanner';

export function Dashboard() {
  const { shards, error, logShards, correctCount, confirmDrop } = useShardData();

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-12 sm:px-6 sm:py-8 sm:pb-16">
      <header className="mb-4 flex items-center justify-between gap-4 sm:mb-6 sm:items-start">
        <div>
          <h1 className="m-0 text-lg font-semibold sm:text-2xl">Shard tracker</h1>
          <p className="mt-1 hidden text-sm text-slate-400 sm:block">
            Sleduj mercy progress a aktuální šanci na drop
          </p>
        </div>
        <UserMenu />
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
    </div>
  );
}
