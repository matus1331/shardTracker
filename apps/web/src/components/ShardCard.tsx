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

export function ShardCard({ data, onLog, onCorrect, onConfirmDrop }: ShardCardProps) {
  const [editing, setEditing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const meta = SHARD_META[data.shardType];
  const { mercyThreshold, guaranteedAt, mercyActive, preMercyProgress, mercyProgress } = getMercyProgress(
    data.shardType,
    data.sinceLastDrop,
  );

  return (
    <div className={`rounded-xl border border-slate-800 border-t-[3px] bg-slate-900 p-5 ${meta.borderClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
          <span>{meta.label}</span>
        </div>
        <span className="text-xs tracking-wide text-slate-400 uppercase">{meta.dropLabel}</span>
      </div>

      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">{(data.currentChance * 100).toFixed(1)}%</span>
        <span className="text-xs text-slate-400">aktuálna šanca</span>
      </div>

      <div className="mb-2">
        <div className="mb-1.5 flex justify-between text-xs text-slate-400">
          <span>{mercyActive ? 'mercy aktívny' : 'do aktivácie mercy'}</span>
          <span>
            {mercyActive
              ? `${data.sinceLastDrop - mercyThreshold} / ${guaranteedAt - mercyThreshold} do garancie`
              : `${data.sinceLastDrop} / ${mercyThreshold}`}
          </span>
        </div>
        <MercyProgressBar
          mercyThreshold={mercyThreshold}
          guaranteedAt={guaranteedAt}
          preMercyProgress={preMercyProgress}
          mercyProgress={mercyProgress}
          fillClass={meta.fillClass}
          neonBgClass={meta.neonBgClass}
          neonGlowClass={meta.neonGlowClass}
        />
      </div>

      <LifetimeStats
        lifetimeOpened={data.lifetimeOpened}
        lifetimeDrops={data.lifetimeDrops}
        dropLabel={meta.dropLabel}
      />

      <LogShardsForm
        shardType={data.shardType}
        maxAmount={guaranteedAt - data.sinceLastDrop}
        onSubmit={onLog}
      />

      <button
        type="button"
        onClick={() => setCelebrating(true)}
        className={`mt-2.5 w-full rounded-lg border py-2 text-sm font-medium transition-colors ${meta.celebrationButtonClass}`}
      >
        {meta.celebrationButtonLabel}
      </button>

      <button
        className="mt-2.5 border-none bg-transparent p-0 text-xs text-slate-400 underline"
        onClick={() => setEditing(true)}
      >
        Upraviť počet
      </button>

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
