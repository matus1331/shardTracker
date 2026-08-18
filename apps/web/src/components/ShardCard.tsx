import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { getMercyProgress, getMercyProgressForConfig, MERCY_CONFIGS, PRIMAL_LEGENDARY_MERCY_CONFIG } from '@rsl/mercy-calc';
import type { ShardCounterState } from '../types';
import { SHARD_META } from '../types';
import { MercyProgressBar } from './MercyProgressBar';
import { LogShardsForm } from './LogShardsForm';
import { EditCountModal } from './EditCountModal';
import { DropCelebrationModal } from './DropCelebrationModal';
import { ShardIcon } from './ShardIcons';
import { formatEventCountdown } from '../utils/formatEventCountdown';
import {
  EXTRA_LEGENDARY_BADGE_CLASS,
  EXTRA_LEGENDARY_BADGE_LABEL,
  EXTRA_LEGENDARY_CARD_ACCENT_CLASS,
  EXTRA_LEGENDARY_TEXT_CLASS,
} from '../utils/eventBadge';

interface ShardCardProps {
  data: ShardCounterState;
  onLog: (shardType: ShardType, amount: number, gotDrop: boolean) => Promise<void>;
  onCorrect: (shardType: ShardType, value: number, gotDrop: boolean, rarity?: 'LEGENDARY' | 'MYTHICAL') => Promise<void>;
  onConfirmDrop: (
    shardType: ShardType,
    championName: string,
    extraChampionName?: string,
    rarity?: 'LEGENDARY' | 'MYTHICAL',
  ) => Promise<void>;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 2l2.2 6.8H21l-5.6 4.1 2.1 6.9L12 15.8 6.5 19.8l2.1-6.9L3 8.8h6.8Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Left side always answers "how many have I opened" — that figure must never
 * disappear once mercy activates. Right side always answers "how many until
 * the next milestone" (mercy or the guarantee). */
function mercyCaption(sinceLastDrop: number, mercyThreshold: number, guaranteedAt: number, mercyActive: boolean) {
  const primary = `${sinceLastDrop} otevřených`;
  if (mercyActive) {
    const remaining = Math.max(guaranteedAt - sinceLastDrop, 0);
    const secondary = remaining === 0 ? 'garantovaný drop' : `ještě ${remaining} do garance`;
    return { primary, secondary };
  }
  const remaining = mercyThreshold - sinceLastDrop;
  return { primary, secondary: `ještě ${remaining} do mercy` };
}

export function ShardCard({ data, onLog, onCorrect, onConfirmDrop }: ShardCardProps) {
  const [editing, setEditing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const meta = SHARD_META[data.shardType];
  const isMultiplierEvent = data.activeEvent?.kind === 'MULTIPLIER';
  const isExtraLegendaryEvent = data.activeEvent?.kind === 'EXTRA_LEGENDARY';
  const { mercyThreshold, guaranteedAt, mercyActive, preMercyProgress, mercyProgress } = getMercyProgress(
    data.shardType,
    data.sinceLastDrop,
    { multiplier: isMultiplierEvent ? data.activeEvent!.multiplier : 1 },
  );

  const caption = mercyCaption(data.sinceLastDrop, mercyThreshold, guaranteedAt, mercyActive);

  const legendary = data.legendaryTrack;
  const legendaryProgress = legendary ? getMercyProgressForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, legendary.sinceLastDrop) : null;
  const legendaryCaption = legendary
    ? mercyCaption(
        legendary.sinceLastDrop,
        PRIMAL_LEGENDARY_MERCY_CONFIG.mercyThreshold,
        legendaryProgress!.guaranteedAt,
        legendaryProgress!.mercyActive,
      )
    : null;

  const baseChancePct = (MERCY_CONFIGS[data.shardType].baseChance * 100).toFixed(1);
  const currentChancePct = (data.currentChance * 100).toFixed(1);

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] bg-slate-900 p-4 sm:p-5 ${
        isExtraLegendaryEvent
          ? `border-2 ${EXTRA_LEGENDARY_CARD_ACCENT_CLASS} animate-[pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none`
          : isMultiplierEvent
            ? `border-2 ${meta.eventAccentClass} animate-[pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none`
            : 'border border-slate-800'
      }`}
    >
      <div className={`pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full opacity-20 blur-3xl ${meta.fillClass}`} />

      <div className="relative mb-3 flex items-center gap-2.5">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950/60 ring-1 ring-slate-800 sm:h-11 sm:w-11">
          <div className={`absolute inset-0 rounded-xl opacity-35 blur-md ${meta.fillClass}`} />
          <ShardIcon shardType={data.shardType} className="relative h-7 w-7" />
        </div>
        <span className="font-display flex-1 text-[14px] font-semibold">{meta.label}</span>
        {isMultiplierEvent && (
          <span className="animate-[pulse_2.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-900 shadow-[0_0_8px_1px_rgba(251,191,36,0.6)] motion-reduce:animate-none">
            ⚡ 2×
          </span>
        )}
        {isExtraLegendaryEvent && <span className={EXTRA_LEGENDARY_BADGE_CLASS}>{EXTRA_LEGENDARY_BADGE_LABEL}</span>}
      </div>

      <div className="relative mb-3">
        <p className="mb-0.5 text-[10.5px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Aktuální šance</p>
        <div className="mb-1 flex items-baseline gap-1.5">
          {isMultiplierEvent && (
            <>
              <span className="font-mono text-sm text-slate-500 line-through tabular-nums">{baseChancePct}%</span>
              <span className="text-sm text-slate-500">→</span>
            </>
          )}
          <span
            className={`font-mono bg-gradient-to-br from-white ${meta.gradientToClass} bg-clip-text text-2xl font-bold tabular-nums text-transparent sm:text-[28px]`}
          >
            {currentChancePct}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">{mercyActive ? 'mercy aktivní' : 'mimo mercy'}</p>
          {legendary && (
            <span className="rounded-full bg-[#A30000]/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#E05B5B] uppercase">
              Mythical
            </span>
          )}
        </div>
      </div>

      <div className="relative mb-3">
        <MercyProgressBar
          mercyThreshold={mercyThreshold}
          guaranteedAt={guaranteedAt}
          preMercyProgress={preMercyProgress}
          mercyProgress={mercyProgress}
          fillClass={meta.fillClass}
          neonBgClass={meta.neonBgClass}
          neonGlowClass={meta.neonGlowClass}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums">
          <span className={isExtraLegendaryEvent ? EXTRA_LEGENDARY_TEXT_CLASS : 'text-amber-400'}>
            {data.activeEvent
              ? formatEventCountdown(data.activeEvent.endAt, isExtraLegendaryEvent ? 'Extra Legendary event' : '2x event')
              : ''}
          </span>
          <span className="font-mono text-slate-500">
            <span className="text-slate-400">{caption.primary}</span> · {caption.secondary}
          </span>
        </div>
      </div>

      {legendary && legendaryProgress && legendaryCaption && (
        <div className="relative mb-3 border-t border-slate-800 pt-3">
          <span className="font-mono text-lg font-bold tabular-nums text-amber-400">{(legendary.currentChance * 100).toFixed(1)}%</span>
          <div className="mt-1 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{legendaryProgress.mercyActive ? 'mercy aktivní' : 'mimo mercy'}</span>
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-400 uppercase">
              Legendary
            </span>
          </div>
          <MercyProgressBar
            mercyThreshold={legendaryProgress.mercyThreshold}
            guaranteedAt={legendaryProgress.guaranteedAt}
            preMercyProgress={legendaryProgress.preMercyProgress}
            mercyProgress={legendaryProgress.mercyProgress}
            fillClass="bg-amber-500"
            neonBgClass="bg-amber-400"
            neonGlowClass="shadow-[0_0_10px_2px_rgba(251,191,36,0.8)]"
          />
          <div className="font-mono mt-1 text-[11px] tabular-nums text-slate-500">
            <span className="text-slate-400">{legendaryCaption.primary}</span> · {legendaryCaption.secondary}
          </div>
        </div>
      )}

      <div className="relative flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <LogShardsForm shardType={data.shardType} maxAmount={guaranteedAt - data.sinceLastDrop} onSubmit={onLog} />
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Upravit počet"
          aria-label="Upravit počet"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={() => setCelebrating(true)}
          title={meta.celebrationButtonLabel}
          aria-label={meta.celebrationButtonLabel}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.celebrationButtonClass}`}
        >
          <DropIcon />
        </button>
      </div>

      {editing && (
        <EditCountModal
          shardType={data.shardType}
          currentValue={data.sinceLastDrop}
          dropFlagLabel={meta.dropFlagLabel}
          legendaryValue={data.legendaryTrack?.sinceLastDrop}
          onClose={() => setEditing(false)}
          onSubmit={onCorrect}
        />
      )}

      {celebrating && (
        <DropCelebrationModal
          title={meta.celebrationTitle}
          shardType={data.shardType}
          extraLegendaryActive={isExtraLegendaryEvent}
          dualRarity={data.shardType === 'PRIMAL'}
          onCancel={() => setCelebrating(false)}
          onConfirm={async (championName, extraChampionName, rarity) => {
            await onConfirmDrop(data.shardType, championName, extraChampionName || undefined, rarity);
            setCelebrating(false);
          }}
        />
      )}
    </div>
  );
}
