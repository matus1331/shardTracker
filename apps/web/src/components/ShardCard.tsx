import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { getMercyProgress } from '@rsl/mercy-calc';
import type { ShardCounterState } from '../types';
import { SHARD_META } from '../types';
import { MercyProgressBar } from './MercyProgressBar';
import { LifetimeStats } from './LifetimeStats';
import { LogShardsForm } from './LogShardsForm';
import { EditCountModal } from './EditCountModal';
import { DropCelebrationModal } from './DropCelebrationModal';

interface ShardCardProps {
  data: ShardCounterState;
  onLog: (shardType: ShardType, amount: number, gotDrop: boolean) => Promise<void>;
  onCorrect: (shardType: ShardType, value: number, gotDrop: boolean) => Promise<void>;
  onConfirmDrop: (shardType: ShardType) => Promise<void>;
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

export function ShardCard({ data, onLog, onCorrect, onConfirmDrop }: ShardCardProps) {
  const [editing, setEditing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const meta = SHARD_META[data.shardType];
  const { mercyThreshold, guaranteedAt, mercyActive, preMercyProgress, mercyProgress } = getMercyProgress(
    data.shardType,
    data.sinceLastDrop,
  );

  const progressCaption = mercyActive
    ? `${data.sinceLastDrop - mercyThreshold} / ${guaranteedAt - mercyThreshold} do garance`
    : `${data.sinceLastDrop} / ${mercyThreshold} do mercy`;

  return (
    <div className={`rounded-xl border border-slate-800 border-l-[3px] bg-slate-900 p-4 ${meta.borderClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
          <span>{meta.label}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${meta.pillClass}`}>
          {meta.dropLabel}
        </span>
      </div>

      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums">{(data.currentChance * 100).toFixed(1)}%</span>
          <span className="text-[11px] whitespace-nowrap text-slate-500">
            {mercyActive ? 'mercy aktivní' : 'aktuální šance'}
          </span>
        </div>
        <LifetimeStats
          lifetimeOpened={data.lifetimeOpened}
          lifetimeDrops={data.lifetimeDrops}
          dropLabel={meta.dropLabel}
        />
      </div>

      <div className="mb-3">
        <MercyProgressBar
          mercyThreshold={mercyThreshold}
          guaranteedAt={guaranteedAt}
          preMercyProgress={preMercyProgress}
          mercyProgress={mercyProgress}
          fillClass={meta.fillClass}
          neonBgClass={meta.neonBgClass}
          neonGlowClass={meta.neonGlowClass}
        />
        <div className="mt-1 text-right text-[11px] text-slate-500 tabular-nums">{progressCaption}</div>
      </div>

      <div className="flex items-start gap-2">
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
          onClose={() => setEditing(false)}
          onSubmit={onCorrect}
        />
      )}

      {celebrating && (
        <DropCelebrationModal
          title={meta.celebrationTitle}
          onCancel={() => setCelebrating(false)}
          onConfirm={async () => {
            await onConfirmDrop(data.shardType);
            setCelebrating(false);
          }}
        />
      )}
    </div>
  );
}
