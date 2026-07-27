import { useEffect, useState } from 'react';
import { fetchShards } from '../api/client';
import { fetchDrops } from '../api/dropsClient';
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

  return { drops, counters, error };
}
