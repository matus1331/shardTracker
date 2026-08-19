import { useCallback, useEffect, useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { addShards, correctSinceLastDrop, fetchShards } from '../api/client';
import type { ShardCounterState } from '../types';

export function useShardData() {
  const [shards, setShards] = useState<ShardCounterState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return fetchShards()
      .then(setShards)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logShards = useCallback(async (shardType: ShardType, amount: number, gotDrop: boolean) => {
    const updated = await addShards(shardType, amount, gotDrop);
    setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
  }, []);

  const correctCount = useCallback(
    async (shardType: ShardType, value: number, gotDrop: boolean, rarity?: 'LEGENDARY' | 'MYTHICAL') => {
      const updated = await correctSinceLastDrop(shardType, value, gotDrop, undefined, undefined, rarity);
      setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
    },
    [],
  );

  const confirmDrop = useCallback(
    async (shardType: ShardType, championName: string, extraChampionName?: string, rarity?: 'LEGENDARY' | 'MYTHICAL') => {
      const current = shards?.find((s) => s.shardType === shardType);
      const targetsLegendary = shardType === 'PRIMAL' && rarity === 'LEGENDARY';
      const baseValue = targetsLegendary ? (current?.legendaryTrack?.sinceLastDrop ?? 0) : (current?.sinceLastDrop ?? 0);
      const updated = await correctSinceLastDrop(shardType, baseValue, true, championName, extraChampionName, rarity);
      setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
    },
    [shards],
  );

  return { shards, error, logShards, correctCount, confirmDrop, reload: load };
}
