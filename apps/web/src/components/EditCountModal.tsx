import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';

interface EditCountModalProps {
  shardType: ShardType;
  currentValue: number;
  dropFlagLabel: string;
  onClose: () => void;
  onSubmit: (shardType: ShardType, value: number, gotDrop: boolean) => Promise<void>;
}

export function EditCountModal({ shardType, currentValue, dropFlagLabel, onClose, onSubmit }: EditCountModalProps) {
  const [value, setValue] = useState(String(currentValue));
  const [gotDrop, setGotDrop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const isValid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(shardType, parsed, gotDrop);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úprava se nezdařila');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/55" onClick={onClose}>
      <div
        className="w-72 rounded-xl border border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm font-semibold">Upravit počet od posledního dropu</p>
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
            autoFocus
            className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 focus:border-slate-500 focus:outline-none"
          />
          <label className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={gotDrop}
              onChange={(e) => setGotDrop(e.target.checked)}
              disabled={submitting}
              className="h-3.5 w-3.5"
            />
            {dropFlagLabel}
          </label>
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
