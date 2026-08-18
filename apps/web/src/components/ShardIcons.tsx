import type { ShardType } from '@rsl/mercy-calc';

const GOLD = '#E3C583';
const GOLD_DARK = '#9a7a3a';

function GoldAccent() {
  return (
    <>
      <polygon points="24,17 33,23 24,29 15,23" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="24,23 33,23 24,29" fill={GOLD_DARK} />
    </>
  );
}

function AncientIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,2 4,17 17,21 24,23" fill="#7DA8F8" />
        <polygon points="24,2 24,23 31,21 44,17" fill="#2563EB" />
        <polygon points="17,21 24,23 24,47" fill="#3B82F6" />
        <polygon points="24,23 31,21 24,47" fill="#1D4ED8" />
      </g>
      <GoldAccent />
    </svg>
  );
}

function VoidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="22,2 2,20 16,23 22,24" fill="#B29CF9" />
        <polygon points="22,2 22,24 29,22 41,11" fill="#7C4FE0" />
        <polygon points="16,23 22,24 25,47" fill="#8B5CF6" />
        <polygon points="22,24 29,22 25,47" fill="#5B21B6" />
      </g>
      <polygon points="23,18 32,23 23,30 14,24" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="23,24 32,23 23,30" fill={GOLD_DARK} />
    </svg>
  );
}

function SacredIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,4 8,17 18,21 24,23" fill="#FDE59A" />
        <polygon points="24,4 24,23 30,21 40,17" fill="#F0B429" />
        <polygon points="18,21 24,23 24,42" fill="#FBBF24" />
        <polygon points="24,23 30,21 24,42" fill="#B8860B" />
      </g>
      <g fill="#FDF3D6" opacity="0.95">
        <polygon points="6,3 8,7 6,11 4,7" />
        <polygon points="42,29 44,33 42,37 40,33" />
      </g>
      <polygon points="24,17 32,22 24,28 16,22" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="24,22 32,22 24,28" fill={GOLD_DARK} />
    </svg>
  );
}

function PrimalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,0 5,15 16,20 24,22" fill="#E05B5B" />
        <polygon points="24,0 24,22 32,20 43,15" fill="#C83232" />
        <polygon points="16,20 24,22 24,48" fill="#A30000" />
        <polygon points="24,22 32,20 24,48" fill="#6E0000" />
        <polygon points="5,15 -3,19 10,18" fill="#7A1010" />
      </g>
      <polygon points="24,16 33,21 24,27 15,21" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="24,21 33,21 24,27" fill={GOLD_DARK} />
    </svg>
  );
}

function RemnantIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,3 30,15 24,24" fill="#E05B5B" />
        <polygon points="24,3 18,15 24,24" fill="#C24444" />
        <polygon points="45,24 33,20 24,24" fill="#C83232" />
        <polygon points="3,24 15,20 24,24" fill="#D06B6B" />
        <polygon points="24,45 30,33 24,24" fill="#A30000" />
        <polygon points="24,45 18,33 24,24" fill="#7A1818" />
        <polygon points="45,24 33,28 24,24" fill="#5C0F0F" />
        <polygon points="3,24 15,28 24,24" fill="#7A1F1F" />
      </g>
    </svg>
  );
}

const ICONS: Record<ShardType, (props: { className?: string }) => React.JSX.Element> = {
  ANCIENT: AncientIcon,
  VOID: VoidIcon,
  PRIMAL: PrimalIcon,
  SACRED: SacredIcon,
  REMNANT: RemnantIcon,
};

export function ShardIcon({ shardType, className }: { shardType: ShardType; className?: string }) {
  const Icon = ICONS[shardType];
  return <Icon className={className} />;
}
