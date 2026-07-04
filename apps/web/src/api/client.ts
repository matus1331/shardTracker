import type { ShardType } from '@rsl/mercy-calc';
import type { ShardCounterState } from '../types';

async function handleResponse(res: Response): Promise<ShardCounterState> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Request failed');
  }
  return res.json();
}

export function fetchShards(): Promise<ShardCounterState[]> {
  return fetch('/api/shards', { credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Failed to load shard data');
    return res.json();
  });
}

export function addShards(shardType: ShardType, amount: number, gotDrop: boolean): Promise<ShardCounterState> {
  return fetch(`/api/shards/${shardType}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ amount, gotDrop }),
  }).then(handleResponse);
}

export function correctSinceLastDrop(shardType: ShardType, value: number, gotDrop: boolean): Promise<ShardCounterState> {
  return fetch(`/api/shards/${shardType}/since-last-drop`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value, gotDrop }),
  }).then(handleResponse);
}
