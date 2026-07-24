import type { ShardType } from '@rsl/mercy-calc';

export interface MercyEvent {
  id: number;
  groupId: string;
  shardType: ShardType;
  /** ISO 8601 UTC datetime, e.g. '2026-07-24T08:00:00Z'. */
  startAt: string;
  endAt: string;
  multiplier: number;
  label: string | null;
}

async function handleEventsResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Požadavek se nezdařil');
  }
  return res.json();
}

export function fetchEvents(): Promise<MercyEvent[]> {
  return fetch('/api/events', { credentials: 'include' }).then((res) => handleEventsResponse<MercyEvent[]>(res));
}

export function createEvent(
  shardTypes: ShardType[],
  startAt: string,
  endAt: string,
  label: string,
): Promise<{ groupId: string }> {
  return fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ shardTypes, startAt, endAt, label: label.trim() || undefined }),
  }).then((res) => handleEventsResponse<{ groupId: string }>(res));
}

export function deleteEventGroup(groupId: string): Promise<void> {
  return fetch(`/api/events/${groupId}`, { method: 'DELETE', credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Smazání se nezdařilo');
  });
}
