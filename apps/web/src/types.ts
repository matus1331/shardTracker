import type { ShardType } from "@rsl/mercy-calc";

export interface ActiveMercyEvent {
  multiplier: number;
  /** ISO 8601 UTC datetime, e.g. '2026-07-27T08:00:00Z'. */
  endAt: string;
  label: string | null;
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY';
}

export interface LegendaryMercyState {
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
}

export interface ShardCounterState {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
  activeEvent: ActiveMercyEvent | null;
  /** Primal's independent Legendary pity track. Null for every other shard type. */
  legendaryTrack: LegendaryMercyState | null;
}

export interface DropRecord {
  shardType: ShardType;
  /** ISO 8601 UTC datetime. */
  createdAt: string;
  /** Which shard in the series (since the previous drop) this one landed on. */
  seriesNumber: number;
  championName: string | null;
  /** Link to the champion's HellHades detail/rating page, if the name matched a known champion. */
  championUrl: string | null;
  /** Bonus champion from an active Extra Legendary event, if the player reported one. */
  extraChampionName: string | null;
  extraChampionUrl: string | null;
  eventKind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null;
  mercyActive: boolean;
  /** Which of Primal's two tracks this drop belongs to. Null for every other shard type. */
  rarity: 'LEGENDARY' | 'MYTHICAL' | null;
}

export interface ShardMeta {
  label: string;
  dropLabel: string;
  dropFlagLabel: string;
  /** Shown in the drop history when no champion name was recorded for that drop. */
  genericChampionLabel: string;
  dotClass: string;
  borderClass: string;
  /** Normal-saturation shard color, used for the dot and the pre-mercy bar segment. */
  fillClass: string;
  /** Literal Tailwind `to-*` class (not derived at runtime, so the JIT scanner can see it)
   * for the hero-number gradient's end color. */
  gradientToClass: string;
  /** Brighter neon background used for the active-mercy bar segment. */
  neonBgClass: string;
  /** Glow shadow for the active-mercy bar segment, applied only once it has visible fill. */
  neonGlowClass: string;
  /** Stronger border + glow shown around the whole card while a 2x event is active for this shard — color-matched to the shard, mirroring the game's portal glow. */
  eventAccentClass: string;
  textClass: string;
  /** Background + text for the drop-type pill (LEGENDARY/MYTHICAL badge). */
  pillClass: string;
  celebrationTitle: string;
  celebrationButtonLabel: string;
  celebrationButtonClass: string;
}

export const SHARD_META: Record<ShardType, ShardMeta> = {
  ANCIENT: {
    label: "Ancient shard",
    dropLabel: "legendary",
    dropFlagLabel: "padl legendary v této dávce",
    genericChampionLabel: "Legendární šampion",
    dotClass: "bg-blue-500",
    borderClass: "border-t-blue-500",
    fillClass: "bg-blue-500",
    gradientToClass: "to-blue-400",
    neonBgClass: "bg-blue-400",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(59,130,246,0.8)]",
    eventAccentClass: "border-blue-400 shadow-[0_0_18px_3px_rgba(59,130,246,0.5)]",
    textClass: "text-blue-400",
    pillClass: "bg-blue-500/15 text-blue-400",
    celebrationTitle: "Gratulujeme k Legendě!",
    celebrationButtonLabel: "Padlo mi lego! 🎉",
    celebrationButtonClass:
      "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
  },
  VOID: {
    label: "Void shard",
    dropLabel: "legendary",
    dropFlagLabel: "padl legendary v této dávce",
    genericChampionLabel: "Legendární šampion",
    dotClass: "bg-violet-500",
    borderClass: "border-t-violet-500",
    fillClass: "bg-violet-500",
    gradientToClass: "to-violet-400",
    neonBgClass: "bg-violet-400",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(139,92,246,0.8)]",
    eventAccentClass: "border-violet-400 shadow-[0_0_18px_3px_rgba(139,92,246,0.5)]",
    textClass: "text-violet-400",
    pillClass: "bg-violet-500/15 text-violet-400",
    celebrationTitle: "Gratulujeme k Legendě!",
    celebrationButtonLabel: "Padlo mi lego! 🎉",
    celebrationButtonClass:
      "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
  },
  PRIMAL: {
    label: "Primal shard",
    dropLabel: "mythical",
    dropFlagLabel: "padl mytický šampion v této dávce",
    genericChampionLabel: "Mytický šampion",
    dotClass: "bg-[#A30000]",
    borderClass: "border-t-[#A30000]",
    fillClass: "bg-[#A30000]",
    gradientToClass: "to-[#C83232]",
    neonBgClass: "bg-[#C83232]",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(200,50,50,0.8)]",
    eventAccentClass: "border-[#C83232] shadow-[0_0_18px_3px_rgba(200,50,50,0.5)]",
    textClass: "text-[#C83232]",
    pillClass: "bg-[#A30000]/15 text-[#C83232]",
    celebrationTitle: "Gratulujeme k mytickému šampionovi!",
    celebrationButtonLabel: "Padl mi mytický šampion! 🎉",
    celebrationButtonClass:
      "border-[#A30000]/40 bg-[#A30000]/10 text-[#C83232] hover:bg-[#A30000]/20",
  },
  SACRED: {
    label: "Sacred shard",
    dropLabel: "legendary",
    dropFlagLabel: "padl legendary v této dávce",
    genericChampionLabel: "Legendární šampion",
    dotClass: "bg-amber-400",
    borderClass: "border-t-amber-400",
    fillClass: "bg-amber-400",
    gradientToClass: "to-amber-400",
    neonBgClass: "bg-amber-300",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(245,158,11,0.8)]",
    eventAccentClass: "border-amber-300 shadow-[0_0_18px_3px_rgba(245,158,11,0.5)]",
    textClass: "text-amber-400",
    pillClass: "bg-amber-400/15 text-amber-400",
    celebrationTitle: "Gratulujeme k Legendě!",
    celebrationButtonLabel: "Padlo mi lego! 🎉",
    celebrationButtonClass:
      "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20",
  },
  REMNANT: {
    label: "Remnant summon",
    dropLabel: "mythical",
    dropFlagLabel: "padl mytický šampion v této dávce",
    genericChampionLabel: "Mytický šampion",
    dotClass: "bg-[#A30000]",
    borderClass: "border-t-[#A30000]",
    fillClass: "bg-[#A30000]",
    gradientToClass: "to-[#C83232]",
    neonBgClass: "bg-[#C83232]",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(200,50,50,0.8)]",
    eventAccentClass: "border-[#C83232] shadow-[0_0_18px_3px_rgba(200,50,50,0.5)]",
    textClass: "text-[#C83232]",
    pillClass: "bg-[#A30000]/15 text-[#C83232]",
    celebrationTitle: "Gratulujeme k mytickému šampionovi!",
    celebrationButtonLabel: "Padl mi mytický šampion! 🎉",
    celebrationButtonClass:
      "border-[#A30000]/40 bg-[#A30000]/10 text-[#C83232] hover:bg-[#A30000]/20",
  },
};
