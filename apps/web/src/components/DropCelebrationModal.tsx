import { useEffect, useId, useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { fetchChampionSuggestions } from '../api/dropsClient';

interface DropCelebrationModalProps {
  title: string;
  shardType: ShardType;
  onConfirm: (championName: string) => Promise<void>;
  onCancel: () => void;
}

export function DropCelebrationModal({ title, shardType, onConfirm, onCancel }: DropCelebrationModalProps) {
  const [championName, setChampionName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datalistId = useId();

  useEffect(() => {
    fetchChampionSuggestions(shardType)
      .then(setSuggestions)
      .catch(() => {});
  }, [shardType]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(championName.trim());
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
        <label className="mb-5 block text-left">
          <span className="mb-1 block text-xs text-slate-400">Jméno šampiona (nepovinné)</span>
          <input
            type="text"
            value={championName}
            onChange={(e) => setChampionName(e.target.value)}
            disabled={submitting}
            placeholder="např. Tormin the Cold"
            list={datalistId}
            maxLength={80}
            className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <datalist id={datalistId}>
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
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
            disabled={submitting}
            className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Resetuji…' : 'Ano, resetovat'}
          </button>
        </div>
      </div>
    </div>
  );
}
