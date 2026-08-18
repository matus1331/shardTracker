interface MercyProgressBarProps {
  mercyThreshold: number;
  guaranteedAt: number;
  preMercyProgress: number;
  mercyProgress: number;
  fillClass: string;
  neonBgClass: string;
  neonGlowClass: string;
}

export function MercyProgressBar({
  mercyThreshold,
  guaranteedAt,
  preMercyProgress,
  mercyProgress,
  fillClass,
  neonBgClass,
  neonGlowClass,
}: MercyProgressBarProps) {
  const preWidthPct = (mercyThreshold / guaranteedAt) * 100;
  const mercyWidthPct = 100 - preWidthPct;

  return (
    <div className="relative flex h-2.5 gap-0.5 py-1">
      <div className="h-2.5 overflow-hidden rounded-l-full bg-slate-800/80" style={{ width: `${preWidthPct}%` }}>
        <div
          className={`h-full rounded-l-full transition-all duration-700 ease-out ${fillClass}`}
          style={{ width: `${preMercyProgress * 100}%` }}
        />
      </div>
      <div className="relative h-2.5 rounded-r-full bg-slate-800/80" style={{ width: `${mercyWidthPct}%` }}>
        <div
          className={`h-full rounded-r-full transition-all duration-700 ease-out ${neonBgClass} ${mercyProgress > 0 ? neonGlowClass : ''}`}
          style={{ width: `${mercyProgress * 100}%` }}
        />
      </div>
      <div className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${preWidthPct}%` }} aria-hidden="true" />
    </div>
  );
}
