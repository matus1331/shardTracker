import type { MercyConfig, ShardType } from './types.js';

export const MERCY_CONFIGS: Record<ShardType, MercyConfig> = {
  ANCIENT: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0 },
  VOID: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0 },
  PRIMAL: { baseChance: 0.005, bonusPerShard: 0.1, mercyThreshold: 200, maxChance: 1.0 },
  SACRED: { baseChance: 0.06, bonusPerShard: 0.02, mercyThreshold: 12, maxChance: 1.0 },
  REMNANT: { baseChance: 0.025, bonusPerShard: 0.01, mercyThreshold: 24, maxChance: 1.0 },
};

function round(value: number): number {
  // Avoid floating-point artifacts (e.g. 0.1 + 0.005 = 0.10500000000000001)
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Chance grows by `bonusPerShard` for every shard opened past `mercyThreshold`
 * (e.g. Void: still base chance at 200 opened, +5% at 201, +10% at 202, ...).
 */
export function calculateDropChance(shardType: ShardType, sinceLastDrop: number): number {
  const config = MERCY_CONFIGS[shardType];
  const shardsPastThreshold = Math.max(0, sinceLastDrop - config.mercyThreshold);
  const chance = config.baseChance + shardsPastThreshold * config.bonusPerShard;
  return round(Math.min(chance, config.maxChance));
}

/** Shard count (since last drop) at which the chance first reaches maxChance. */
export function getGuaranteedAt(shardType: ShardType): number {
  const config = MERCY_CONFIGS[shardType];
  const shardsNeeded = Math.ceil((config.maxChance - config.baseChance) / config.bonusPerShard);
  return config.mercyThreshold + shardsNeeded;
}

export interface MercyProgress {
  sinceLastDrop: number;
  mercyThreshold: number;
  guaranteedAt: number;
  mercyActive: boolean;
  /** 0-1 progress toward reaching mercyThreshold (caps at 1 once reached). */
  preMercyProgress: number;
  /** 0-1 progress from mercyThreshold toward guaranteedAt (0 until mercy is active). */
  mercyProgress: number;
}

export function getMercyProgress(shardType: ShardType, sinceLastDrop: number): MercyProgress {
  const config = MERCY_CONFIGS[shardType];
  const guaranteedAt = getGuaranteedAt(shardType);
  const mercyActive = sinceLastDrop >= config.mercyThreshold;
  const mercyRange = guaranteedAt - config.mercyThreshold;

  return {
    sinceLastDrop,
    mercyThreshold: config.mercyThreshold,
    guaranteedAt,
    mercyActive,
    preMercyProgress: Math.min(1, sinceLastDrop / config.mercyThreshold),
    mercyProgress: mercyActive ? Math.min(1, (sinceLastDrop - config.mercyThreshold) / mercyRange) : 0,
  };
}
