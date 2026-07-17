interface LifetimeStatsProps {
  lifetimeOpened: number;
  lifetimeDrops: number;
  dropLabel: string;
}

export function LifetimeStats({
  lifetimeOpened,
  lifetimeDrops,
  dropLabel,
}: LifetimeStatsProps) {
  return (
    <span className="text-right text-xs whitespace-nowrap text-slate-500 tabular-nums">
      <b className="font-semibold text-slate-400">{lifetimeOpened}</b> otevřených ·{" "}
      <b className="font-semibold text-slate-400">{lifetimeDrops}</b>{" "}
      {dropLabel === "mythical" ? "mytiky" : "legendy"}
    </span>
  );
}
