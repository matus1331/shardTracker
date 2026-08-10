import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { fetchChampionSuggestions } from '../api/dropsClient';

interface DropCelebrationModalProps {
  title: string;
  shardType: ShardType;
  onConfirm: (championName: string) => Promise<void>;
  onCancel: () => void;
}

const MAX_VISIBLE_MATCHES = 8;

function findMatches(query: string, suggestions: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return suggestions.slice(0, MAX_VISIBLE_MATCHES);
  const startsWith = suggestions.filter((s) => s.toLowerCase().startsWith(q));
  const contains = suggestions.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
  return [...startsWith, ...contains].slice(0, MAX_VISIBLE_MATCHES);
}

export function DropCelebrationModal({ title, shardType, onConfirm, onCancel }: DropCelebrationModalProps) {
  const [championName, setChampionName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChampionSuggestions(shardType)
      .then(setSuggestions)
      .catch(() => {});
  }, [shardType]);

  const trimmedName = championName.trim();
  const isKnownChampion = useMemo(
    () => suggestions.some((s) => s.toLowerCase() === trimmedName.toLowerCase()),
    [suggestions, trimmedName],
  );
  const matches = useMemo(() => findMatches(championName, suggestions), [championName, suggestions]);
  const showUnknownWarning = trimmedName !== '' && !isKnownChampion;

  const selectSuggestion = (name: string) => {
    setChampionName(name);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset se nezdařil');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/55" onClick={onCancel}>
      <div
        className="w-80 rounded-xl border border-slate-700 bg-slate-900 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-3xl">🎉</p>
        <p className="mb-2 text-base font-semibold">{title}</p>
        <p className="mb-4 text-sm text-slate-400">
          Chceš teď vynulovat svůj Shard Tracker a začít počítat Mercy counter od nuly?
        </p>
        <label className="mb-1.5 block text-left">
          <span className="mb-1 block text-xs text-slate-400">Jméno šampiona (nepovinné)</span>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={championName}
              onChange={(e) => {
                setChampionName(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setDropdownOpen(false)}
              disabled={submitting}
              placeholder="Začni psát jméno…"
              maxLength={80}
              autoComplete="off"
              className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
            {dropdownOpen && (
              <ul className="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg">
                {matches.length > 0 ? (
                  matches.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(name);
                        }}
                        className="block w-full px-2.5 py-1.5 text-left text-sm text-slate-100 hover:bg-slate-700"
                      >
                        {name}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-2.5 py-1.5 text-left text-xs text-slate-500">Takové lego v seznamu není</li>
                )}
              </ul>
            )}
          </div>
        </label>
        <p className={`mb-3.5 h-3.5 text-left text-[11px] ${showUnknownWarning ? 'text-amber-400' : 'invisible'}`}>
          Takové lego v seznamu není
        </p>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || showUnknownWarning}
            className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Resetuji…' : 'Ano, resetovat'}
          </button>
        </div>
      </div>
    </div>
  );
}
