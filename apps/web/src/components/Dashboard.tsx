import { useShardData } from '../hooks/useShardData';
import { ShardCard } from './ShardCard';
import { UserMenu } from './UserMenu';

export function Dashboard() {
  const { shards, error, logShards, correctCount, confirmDrop } = useShardData();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 pb-16">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold">Shard tracker</h1>
          <p className="mt-1 text-sm text-slate-400">Sleduj mercy progress a aktuálnu šancu na drop</p>
        </div>
        <UserMenu />
      </header>

      {error && <p className="text-sm text-red-400">Nepodarilo sa načítať dáta: {error}</p>}

      {!shards && !error && <p className="text-sm text-slate-400">Načítavam…</p>}

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
