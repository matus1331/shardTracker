import { MERCY_CONFIGS, SHARD_TYPES, type ShardType } from "@rsl/mercy-calc";
import type { DropRecord, ShardCounterState } from "../types";
import { SHARD_META } from "../types";
import { formatDateTime } from "../utils/formatDateTime";

interface StatsTabProps {
  drops: DropRecord[];
  counters: ShardCounterState[];
}

const EVENT_ELIGIBLE_SHARD_TYPES: ShardType[] = [
  "ANCIENT",
  "VOID",
  "PRIMAL",
  "SACRED",
];
const MIN_OPENED_FOR_LUCK_INDEX = 20;

function championOrGeneric(drop: DropRecord): string {
  return drop.championName || SHARD_META[drop.shardType].genericChampionLabel;
}

function ExtremeCard({
  icon,
  label,
  drop,
}: {
  icon: string;
  label: string;
  drop: DropRecord | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="mb-2 text-xs font-semibold text-slate-400">
        {icon} {label}
      </p>
      {drop ? (
        <>
          <p className="text-lg font-bold tabular-nums">
            po{" "}
            <span className={SHARD_META[drop.shardType].textClass}>
              {drop.seriesNumber}
            </span>{" "}
            shardech
          </p>
          <p className="mt-1 text-xs text-slate-500">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${SHARD_META[drop.shardType].dotClass}`}
            />{" "}
            {SHARD_META[drop.shardType].label} · {championOrGeneric(drop)} ·{" "}
            {formatDateTime(drop.createdAt)}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">Zatím žádné dropy</p>
      )}
    </div>
  );
}

function LuckIndexCard({
  shardType,
  counter,
}: {
  shardType: ShardType;
  counter: ShardCounterState | undefined;
}) {
  const meta = SHARD_META[shardType];
  const lifetimeOpened = counter?.lifetimeOpened ?? 0;
  const lifetimeDrops = counter?.lifetimeDrops ?? 0;
  const hasEnoughData = lifetimeOpened >= MIN_OPENED_FOR_LUCK_INDEX;
  const expected = lifetimeOpened * MERCY_CONFIGS[shardType].baseChance;
  const luckIndexPct =
    hasEnoughData && expected > 0
      ? ((lifetimeDrops - expected) / expected) * 100
      : null;
  const lucky = (luckIndexPct ?? 0) >= 0;
  const avgPity =
    lifetimeDrops > 0 ? Math.round(lifetimeOpened / lifetimeDrops) : null;
  const subject = meta.dropLabel === "mythical" ? "Mytický šampion" : "Legenda";

  return (
    <div
      className={`rounded-xl bg-slate-900 p-4 border border-slate-800 border-l-[3px] ${meta.borderClass}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`}
          />
          <span>{meta.label}</span>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">{lifetimeOpened} otevřených</span>
      </div>

      {luckIndexPct !== null ? (
        <>
          <p
            className={`text-2xl font-bold tabular-nums ${lucky ? "text-emerald-400" : "text-rose-400"}`}
          >
            {lucky ? "🍀" : "💀"} {luckIndexPct >= 0 ? "+" : ""}
            {Math.round(luckIndexPct)} %
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {lucky ? "nad průměrem" : "pod průměrem"} · Očekáváno{" "}
            {expected.toFixed(1)} · Skutečně {lifetimeDrops}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Zatím málo dat na spolehlivý odhad ({lifetimeOpened} /{" "}
          {MIN_OPENED_FOR_LUCK_INDEX} shardů)
        </p>
      )}

      <p className="mt-2 text-xs text-slate-400">
        {avgPity !== null ? (
          <>
            {subject} ti padá průměrně po{" "}
            <b className="text-slate-300">{avgPity}</b> shardech.
          </>
        ) : (
          "Zatím žádný drop."
        )}
      </p>
    </div>
  );
}

function EventEfficiencyRow({
  shardType,
  drops,
}: {
  shardType: ShardType;
  drops: DropRecord[];
}) {
  const meta = SHARD_META[shardType];
  const typeDrops = drops.filter((d) => d.shardType === shardType);
  const total = typeDrops.length;
  const duringEvent = typeDrops.filter((d) => d.duringEvent).length;
  const pct = total > 0 ? Math.round((duringEvent / total) * 100) : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5">
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`}
      />
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-300">
        {meta.label.replace(" shard", "").replace(" summon", "")}
      </span>
      {pct !== null ? (
        <>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${meta.fillClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-28 shrink-0 text-right text-xs text-slate-400 tabular-nums">
            {pct} % ({duringEvent} z {total})
          </span>
        </>
      ) : (
        <span className="flex-1 text-xs text-slate-500">Zatím žádný drop</span>
      )}
    </div>
  );
}

export function StatsTab({ drops, counters }: StatsTabProps) {
  const fastest =
    drops.length > 0
      ? drops.reduce((a, b) => (b.seriesNumber < a.seriesNumber ? b : a))
      : null;
  const slowest =
    drops.length > 0
      ? drops.reduce((a, b) => (b.seriesNumber > a.seriesNumber ? b : a))
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ExtremeCard icon="🟢" label="Nejrychlejší drop" drop={fastest} />
        <ExtremeCard
          icon="🔴"
          label="Nejdelší sucho (Hard Mercy)"
          drop={slowest}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">
          Luck Index
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {SHARD_TYPES.map((shardType) => (
            <LuckIndexCard
              key={shardType}
              shardType={shardType}
              counter={counters.find((c) => c.shardType === shardType)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">
          Úspěšnost podle eventů (2× efektivita)
        </h2>
        <div className="flex flex-col gap-2">
          {EVENT_ELIGIBLE_SHARD_TYPES.map((shardType) => (
            <EventEfficiencyRow
              key={shardType}
              shardType={shardType}
              drops={drops}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
