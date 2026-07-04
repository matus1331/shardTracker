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
    <div className="flex h-2 gap-1 py-1">
      <div className="h-2 overflow-hidden rounded-l-full bg-slate-800" style={{ width: `${preWidthPct}%` }}>
        <div
          className={`h-full rounded-l-full transition-all ${fillClass}`}
          style={{ width: `${preMercyProgress * 100}%` }}
        />
      </div>
      <div className="h-2 rounded-r-full bg-slate-800" style={{ width: `${mercyWidthPct}%` }}>
        <div
          className={`h-full rounded-r-full transition-all ${neonBgClass} ${mercyProgress > 0 ? neonGlowClass : ''}`}
          style={{ width: `${mercyProgress * 100}%` }}
        />
      </div>
    </div>
  );
}
