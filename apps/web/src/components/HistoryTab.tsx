import { useState } from 'react';
import { SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import type { DropRecord } from '../types';
import { SHARD_META } from '../types';
import { formatDateTime } from '../utils/formatDateTime';
import { EXTRA_LEGENDARY_BADGE_CLASS, EXTRA_LEGENDARY_BADGE_LABEL } from '../utils/eventBadge';
import { fetchChampionSuggestions } from '../api/dropsClient';
import { ChampionAutocompleteField } from './ChampionAutocompleteField';

interface HistoryTabProps {
  drops: DropRecord[];
  onChampionUpdated: (id: number, championName: string | null) => Promise<void>;
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 4h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4 10 14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DropRow({
  drop,
  onChampionUpdated,
}: {
  drop: DropRecord;
  onChampionUpdated: (id: number, championName: string | null) => Promise<void>;
}) {
  const meta = SHARD_META[drop.shardType];
  const dropLabel = drop.rarity ? drop.rarity.toLowerCase() : meta.dropLabel;
  const pillClass = drop.rarity === 'LEGENDARY' ? 'bg-amber-400/15 text-amber-400' : meta.pillClass;
  const genericChampionLabel = drop.rarity === 'LEGENDARY' ? 'Legendární šampion' : meta.genericChampionLabel;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setName(drop.championName ?? '');
    setUnknown(false);
    setError(null);
    setEditing(true);
    fetchChampionSuggestions(drop.shardType, drop.rarity ?? undefined)
      .then(setSuggestions)
      .catch(() => {});
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onChampionUpdated(drop.id, name.trim() || null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
          <span className="text-[13px] font-semibold whitespace-nowrap">{meta.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${pillClass}`}>
            {dropLabel}
          </span>
          <span className="text-xs text-slate-400 tabular-nums">{drop.seriesNumber}. shard v sérii</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
              drop.mercyActive ? 'bg-slate-700/50 text-slate-400' : 'bg-emerald-500/15 text-emerald-400'
            }`}
          >
            {drop.mercyActive ? 'V MERCY' : 'MIMO MERCY'}
          </span>
          {drop.eventKind === 'MULTIPLIER' && (
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-900">
              ⚡ 2×
            </span>
          )}
          {drop.eventKind === 'EXTRA_LEGENDARY' && (
            <span className={EXTRA_LEGENDARY_BADGE_CLASS}>{EXTRA_LEGENDARY_BADGE_LABEL}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          {!editing && (
            <div className="flex items-center gap-2">
              {drop.championUrl ? (
                <a
                  href={drop.championUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Zobrazit šampiona na HellHades"
                  className="flex items-center gap-1 text-slate-300 hover:text-slate-100 hover:underline"
                >
                  <span>{drop.championName}</span>
                  <ExternalLinkIcon />
                </a>
              ) : (
                <span className={drop.championName ? 'text-slate-300' : 'text-slate-500 italic'}>
                  {drop.championName || genericChampionLabel}
                </span>
              )}
              {drop.extraChampionName &&
                (drop.extraChampionUrl ? (
                  <a
                    href={drop.extraChampionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Zobrazit šampiona na HellHades"
                    className="flex items-center gap-1 text-orange-300 hover:text-orange-200 hover:underline"
                  >
                    <span>+ {drop.extraChampionName}</span>
                    <ExternalLinkIcon />
                  </a>
                ) : (
                  <span className="text-orange-300">+ {drop.extraChampionName}</span>
                ))}
              <button
                type="button"
                onClick={startEdit}
                title="Upravit jméno šampiona"
                className="text-slate-500 hover:text-slate-200"
              >
                <PencilIcon />
              </button>
            </div>
          )}
          <span className="text-slate-500 tabular-nums">{formatDateTime(drop.createdAt)}</span>
        </div>
      </div>
      {editing && (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-800 pt-2">
          <div className="w-56">
            <ChampionAutocompleteField
              label="Jméno šampiona"
              suggestions={suggestions}
              value={name}
              onChange={setName}
              disabled={saving}
              onUnknownChange={setUnknown}
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || unknown}
            className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zrušit
          </button>
          {error && <p className="w-full text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function HistoryTab({ drops, onChampionUpdated }: HistoryTabProps) {
  const [filter, setFilter] = useState<ShardType | 'ALL'>('ALL');
  const filtered = filter === 'ALL' ? drops : drops.filter((d) => d.shardType === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === 'ALL'
              ? 'bg-slate-100 text-slate-900'
              : 'border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          Vše
        </button>
        {SHARD_TYPES.map((shardType) => (
          <button
            key={shardType}
            type="button"
            onClick={() => setFilter(shardType)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === shardType
                ? 'bg-slate-100 text-slate-900'
                : 'border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${SHARD_META[shardType].dotClass}`} />
            {SHARD_META[shardType].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">
          {drops.length === 0
            ? 'Zatím žádné dropy nezaznamenané. Až ti něco padne, objeví se tu.'
            : 'Pro tento typ shardu zatím žádné dropy nejsou.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((drop) => (
            <DropRow key={drop.id} drop={drop} onChampionUpdated={onChampionUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
