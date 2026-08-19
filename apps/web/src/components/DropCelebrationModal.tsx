import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ShardType } from '@rsl/mercy-calc';
import { fetchChampionSuggestions } from '../api/dropsClient';
import { ChampionAutocompleteField } from './ChampionAutocompleteField';
import { EXTRA_LEGENDARY_TEXT_CLASS } from '../utils/eventBadge';

interface DropCelebrationModalProps {
  title: string;
  shardType: ShardType;
  extraLegendaryActive: boolean;
  /** True only for Primal — shows a Mythical/Legendary picker before the champion field. */
  dualRarity: boolean;
  onConfirm: (championName: string, extraChampionName: string, rarity?: 'LEGENDARY' | 'MYTHICAL') => Promise<void>;
  onCancel: () => void;
}

export function DropCelebrationModal({
  title,
  shardType,
  extraLegendaryActive,
  dualRarity,
  onConfirm,
  onCancel,
}: DropCelebrationModalProps) {
  const [rarity, setRarity] = useState<'LEGENDARY' | 'MYTHICAL'>('MYTHICAL');
  const [championName, setChampionName] = useState('');
  const [extraChampionName, setExtraChampionName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [primaryUnknown, setPrimaryUnknown] = useState(false);
  const [extraUnknown, setExtraUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChampionSuggestions(shardType, dualRarity ? rarity : undefined)
      .then(setSuggestions)
      .catch(() => {});
  }, [shardType, dualRarity, rarity]);

  useEffect(() => {
    if (!extraLegendaryActive) {
      setExtraChampionName('');
      setExtraUnknown(false);
    }
  }, [extraLegendaryActive]);

  useEffect(() => {
    if (dualRarity) {
      setChampionName('');
      setPrimaryUnknown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(championName.trim(), extraChampionName.trim(), dualRarity ? rarity : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset se nezdařil');
      setSubmitting(false);
    }
  };

  return createPortal(
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
        {dualRarity && (
          <div className="mb-3 flex rounded-lg border border-slate-700 bg-slate-800 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setRarity('MYTHICAL')}
              disabled={submitting}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                rarity === 'MYTHICAL' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mythical
            </button>
            <button
              type="button"
              onClick={() => setRarity('LEGENDARY')}
              disabled={submitting}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                rarity === 'LEGENDARY' ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Legendary
            </button>
          </div>
        )}
        <ChampionAutocompleteField
          label="Jméno šampiona (nepovinné)"
          suggestions={suggestions}
          value={championName}
          onChange={setChampionName}
          disabled={submitting}
          onUnknownChange={setPrimaryUnknown}
        />
        {extraLegendaryActive && (
          <>
            <p className={`mb-1 text-left text-[11px] font-semibold ${EXTRA_LEGENDARY_TEXT_CLASS}`}>
              🔥 Extra Legendary event aktivní — padla dvě lega?
            </p>
            <ChampionAutocompleteField
              label="Extra lego (nepovinné)"
              suggestions={suggestions}
              value={extraChampionName}
              onChange={setExtraChampionName}
              disabled={submitting}
              onUnknownChange={setExtraUnknown}
              accentClass="border-orange-500/40 focus:border-orange-400"
            />
          </>
        )}
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
            disabled={submitting || primaryUnknown || extraUnknown}
            className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Resetuji…' : 'Ano, resetovat'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
