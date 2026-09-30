import { useEffect, useState } from 'react';
import { fetchShards } from '../api/client';
import { fetchDrops, updateDropChampionName } from '../api/dropsClient';
import type { DropRecord, ShardCounterState } from '../types';

export function useHistoryData() {
  const [drops, setDrops] = useState<DropRecord[] | null>(null);
  const [counters, setCounters] = useState<ShardCounterState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDrops(), fetchShards()])
      .then(([dropsResult, countersResult]) => {
        setDrops(dropsResult);
        setCounters(countersResult);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const updateDropChampion = async (id: number, championName: string | null) => {
    const result = await updateDropChampionName(id, championName);
    setDrops((prev) => prev?.map((d) => (d.id === id ? { ...d, ...result } : d)) ?? prev);
  };

  return { drops, counters, error, updateDropChampion };
}
