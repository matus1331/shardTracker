import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';

interface LogShardsFormProps {
  shardType: ShardType;
  maxAmount: number;
  onSubmit: (shardType: ShardType, amount: number, gotDrop: boolean) => Promise<void>;
}

export function LogShardsForm({ shardType, maxAmount, onSubmit }: LogShardsFormProps) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const exceedsMax = amount.trim() !== '' && Number.isInteger(parsed) && parsed > maxAmount;
  const isValid = amount.trim() !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= maxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(shardType, parsed, false);
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zápis zlyhal');
    } finally {
      setSubmitting(false);
    }
  };

  if (maxAmount < 1) {
    return (
      <p className="text-xs text-slate-400">
        Dosiahnutá garantovaná šanca — zaznamenaj drop pred ďalším otváraním.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={maxAmount}
          step={1}
          placeholder="Počet"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={submitting}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!isValid || submitting}
          className="h-9 shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Ukladám…' : 'Zapísať'}
        </button>
      </div>
      {exceedsMax && (
        <p className="mt-1.5 text-xs text-red-400">
          Max {maxAmount} — od {maxAmount + 1}. shardu je drop garantovaný.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </form>
  );
}
