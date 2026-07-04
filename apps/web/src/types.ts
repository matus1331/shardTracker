import type { ShardType } from "@rsl/mercy-calc";

export interface ShardCounterState {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
}

export interface ShardMeta {
  label: string;
  dropLabel: string;
  dropFlagLabel: string;
  dotClass: string;
  borderClass: string;
  /** Normal-saturation shard color, used for the dot and the pre-mercy bar segment. */
  fillClass: string;
  /** Brighter neon background used for the active-mercy bar segment. */
  neonBgClass: string;
  /** Glow shadow for the active-mercy bar segment, applied only once it has visible fill. */
  neonGlowClass: string;
  textClass: string;
  celebrationTitle: string;
  celebrationButtonLabel: string;
  celebrationButtonClass: string;
}

export const SHARD_META: Record<ShardType, ShardMeta> = {
  ANCIENT: {
    label: "Ancient shard",
    dropLabel: "legendary",
    dropFlagLabel: "padol legendary v tejto dávke",
    dotClass: "bg-blue-500",
    borderClass: "border-t-blue-500",
    fillClass: "bg-blue-500",
    neonBgClass: "bg-blue-400",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(59,130,246,0.8)]",
    textClass: "text-blue-400",
    celebrationTitle: "Gratulujeme k Legende!",
    celebrationButtonLabel: "Spadlo mi lego! 🎉",
    celebrationButtonClass:
      "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
  },
  VOID: {
    label: "Void shard",
    dropLabel: "legendary",
    dropFlagLabel: "padol legendary v tejto dávke",
    dotClass: "bg-violet-500",
    borderClass: "border-t-violet-500",
    fillClass: "bg-violet-500",
    neonBgClass: "bg-violet-400",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(139,92,246,0.8)]",
    textClass: "text-violet-400",
    celebrationTitle: "Gratulujeme k Legende!",
    celebrationButtonLabel: "Spadlo mi lego! 🎉",
    celebrationButtonClass:
      "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
  },
  PRIMAL: {
    label: "Primal shard",
    dropLabel: "mythical",
    dropFlagLabel: "padol mytický šampión v tejto dávke",
    dotClass: "bg-[#A30000]",
    borderClass: "border-t-[#A30000]",
    fillClass: "bg-[#A30000]",
    neonBgClass: "bg-[#C83232]",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(200,50,50,0.8)]",
    textClass: "text-[#C83232]",
    celebrationTitle: "Gratulujeme k Mytickému šampiónovi!",
    celebrationButtonLabel: "Spadol mi mytický šampión! 🎉",
    celebrationButtonClass:
      "border-[#A30000]/40 bg-[#A30000]/10 text-[#C83232] hover:bg-[#A30000]/20",
  },
  SACRED: {
    label: "Sacred shard",
    dropLabel: "legendary",
    dropFlagLabel: "padol legendary v tejto dávke",
    dotClass: "bg-amber-400",
    borderClass: "border-t-amber-400",
    fillClass: "bg-amber-400",
    neonBgClass: "bg-amber-300",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(245,158,11,0.8)]",
    textClass: "text-amber-400",
    celebrationTitle: "Gratulujeme k Legende!",
    celebrationButtonLabel: "Spadlo mi lego! 🎉",
    celebrationButtonClass:
      "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20",
  },
  REMNANT: {
    label: "Remnant summon",
    dropLabel: "mythical",
    dropFlagLabel: "padol mytický šampión v tejto dávke",
    dotClass: "bg-[#A30000]",
    borderClass: "border-t-[#A30000]",
    fillClass: "bg-[#A30000]",
    neonBgClass: "bg-[#C83232]",
    neonGlowClass: "shadow-[0_0_10px_2px_rgba(200,50,50,0.8)]",
    textClass: "text-[#C83232]",
    celebrationTitle: "Gratulujeme k Mytickému šampiónovi!",
    celebrationButtonLabel: "Spadol mi mytický šampión! 🎉",
    celebrationButtonClass:
      "border-[#A30000]/40 bg-[#A30000]/10 text-[#C83232] hover:bg-[#A30000]/20",
  },
};
