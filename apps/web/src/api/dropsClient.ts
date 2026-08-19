import type { ShardType } from '@rsl/mercy-calc';
import type { DropRecord } from '../types';

async function handleDropsResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Požadavek se nezdařil');
  }
  return res.json();
}

export function fetchDrops(): Promise<DropRecord[]> {
  return fetch('/api/drops', { credentials: 'include' }).then((res) => handleDropsResponse<DropRecord[]>(res));
}

export function fetchChampionSuggestions(shardType: ShardType, rarity?: 'LEGENDARY' | 'MYTHICAL'): Promise<string[]> {
  const query = rarity ? `?rarity=${rarity}` : '';
  return fetch(`/api/champions/${shardType}${query}`, { credentials: 'include' }).then((res) =>
    handleDropsResponse<string[]>(res),
  );
}
