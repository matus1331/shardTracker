import { useEffect, useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { SHARD_META } from '../types';
import { createEvent, deleteEventGroup, fetchEvents, type MercyEvent } from '../api/eventsClient';

interface EventsAdminModalProps {
  onClose: () => void;
}

const LEGENDARY_SHARDS: ShardType[] = ['ANCIENT', 'VOID', 'SACRED'];
const MYTHICAL_SHARDS: ShardType[] = ['PRIMAL'];
const EVENT_SHARD_TYPES: ShardType[] = [...LEGENDARY_SHARDS, ...MYTHICAL_SHARDS];

interface EventGroup {
  groupId: string;
  shardTypes: ShardType[];
  startAt: string;
  endAt: string;
  label: string | null;
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupEvents(events: MercyEvent[]): EventGroup[] {
  const byGroup = new Map<string, MercyEvent[]>();
  for (const event of events) {
    const list = byGroup.get(event.groupId) ?? [];
    list.push(event);
    byGroup.set(event.groupId, list);
  }
  return Array.from(byGroup.values()).map((rows) => ({
    groupId: rows[0].groupId,
    shardTypes: rows.map((r) => r.shardType),
    startAt: rows[0].startAt,
    endAt: rows[0].endAt,
    label: rows[0].label,
  }));
}

function isActiveNow(startAt: string, endAt: string): boolean {
  const now = Date.now();
  return new Date(startAt).getTime() <= now && new Date(endAt).getTime() >= now;
}

/** Renders an ISO UTC instant as a UTC-labeled date+time, regardless of the browser's own timezone. */
function formatUtcDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const datePart = parsed.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const timePart = parsed.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${datePart} ${timePart} UTC`;
}

/** Renders the same ISO UTC instant in the browser's own (local) timezone, for orientation. */
function formatLocalDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toIsoUtc(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}

export function EventsAdminModal({ onClose }: EventsAdminModalProps) {
  const [events, setEvents] = useState<MercyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<ShardType>>(new Set());
  const [startDate, setStartDate] = useState(todayIsoUtc());
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(todayIsoUtc());
  const [endTime, setEndTime] = useState('23:59');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const startAt = toIsoUtc(startDate, startTime);
  const endAt = toIsoUtc(endDate, endTime);
  const rangeValid = Date.parse(startAt) < Date.parse(endAt);

  const load = () => {
    fetchEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleShard = (shardType: ShardType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shardType)) next.delete(shardType);
      else next.add(shardType);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0 || !rangeValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEvent(Array.from(selected), startAt, endAt, label);
      setSelected(new Set());
      setLabel('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření se nezdařilo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    setError(null);
    try {
      await deleteEventGroup(groupId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smazání se nezdařilo');
    }
  };

  const groups = events ? groupEvents(events) : [];

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm font-semibold">Naplánovat 2x event</p>

        <form onSubmit={handleCreate} className="mb-5 border-b border-slate-800 pb-5">
          <p className="mb-1.5 text-xs text-slate-400">Shardy</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelected(new Set(LEGENDARY_SHARDS))}
              className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              Legendary
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set(MYTHICAL_SHARDS))}
              className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              Mythical
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-3">
            {EVENT_SHARD_TYPES.map((shardType) => (
              <label key={shardType} className="flex items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={selected.has(shardType)}
                  onChange={() => toggleShard(shardType)}
                  className="h-3.5 w-3.5"
                />
                {SHARD_META[shardType].label}
              </label>
            ))}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-slate-400">Od (UTC)</p>
              <div className="mt-1 flex gap-1">
                <input
                  type="date"
                  aria-label="Datum od (UTC)"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 text-slate-100 focus:border-slate-500 focus:outline-none"
                />
                <input
                  type="time"
                  aria-label="Čas od (UTC)"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 w-24 shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 text-slate-100 focus:border-slate-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">≈ {formatLocalDateTime(startAt)} tvého času</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Do (UTC)</p>
              <div className="mt-1 flex gap-1">
                <input
                  type="date"
                  aria-label="Datum do (UTC)"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 text-slate-100 focus:border-slate-500 focus:outline-none"
                />
                <input
                  type="time"
                  aria-label="Čas do (UTC)"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 w-24 shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 text-slate-100 focus:border-slate-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">≈ {formatLocalDateTime(endAt)} tvého času</p>
            </div>
          </div>

          <input
            type="text"
            placeholder="Název (volitelné)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mb-3 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          />

          {!rangeValid && <p className="mb-2 text-xs text-red-400">Začátek musí předcházet konci.</p>}
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={selected.size === 0 || !rangeValid || submitting}
            className="h-9 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Ukládám…' : 'Naplánovat event'}
          </button>
        </form>

        <p className="mb-2 text-xs text-slate-400">Naplánované eventy</p>
        {!events && <p className="text-xs text-slate-500">Načítání…</p>}
        {events && groups.length === 0 && <p className="text-xs text-slate-500">Zatím žádné eventy.</p>}
        <ul className="space-y-2">
          {groups.map((group) => (
            <li
              key={group.groupId}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                isActiveNow(group.startAt, group.endAt)
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                  : 'border-slate-800 bg-slate-800/50 text-slate-400'
              }`}
            >
              <div>
                <p className="font-medium">
                  {group.shardTypes.map((s) => SHARD_META[s].label).join(', ')}
                  {group.label ? ` — ${group.label}` : ''}
                </p>
                <p>
                  {formatUtcDateTime(group.startAt)} → {formatUtcDateTime(group.endAt)}
                </p>
                <p className="text-slate-500">
                  tvůj čas: {formatLocalDateTime(group.startAt)} → {formatLocalDateTime(group.endAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(group.groupId)}
                className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:bg-red-500/20 hover:text-red-300"
              >
                Smazat
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
