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
    <p className="mb-4 text-xs text-slate-500">
      Celkovo otvorených: {lifetimeOpened} · Získané{" "}
      {dropLabel === "mythical" ? "mytiky" : "legendy"}: {lifetimeDrops}
    </p>
  );
}
