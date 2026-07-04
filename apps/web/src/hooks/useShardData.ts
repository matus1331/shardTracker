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

  const correctCount = useCallback(async (shardType: ShardType, value: number, gotDrop: boolean) => {
    const updated = await correctSinceLastDrop(shardType, value, gotDrop);
    setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
  }, []);

  const confirmDrop = useCallback(async (shardType: ShardType) => {
    const updated = await correctSinceLastDrop(shardType, 0, true);
    setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
  }, []);

  return { shards, error, logShards, correctCount, confirmDrop, reload: load };
}
