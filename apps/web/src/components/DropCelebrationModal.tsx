import { useState } from 'react';

interface DropCelebrationModalProps {
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DropCelebrationModal({ title, onConfirm, onCancel }: DropCelebrationModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
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
        <p className="mb-5 text-sm text-slate-400">
          Chceš teď vynulovat svůj Shard Tracker a začít počítat Mercy counter od nuly?
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
