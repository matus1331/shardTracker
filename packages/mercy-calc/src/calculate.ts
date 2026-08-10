import type { MercyConfig, ShardType } from './types.js';

export const MERCY_CONFIGS: Record<ShardType, MercyConfig> = {
  ANCIENT: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0, rarity: 'LEGENDARY' },
  VOID: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0, rarity: 'LEGENDARY' },
  PRIMAL: { baseChance: 0.005, bonusPerShard: 0.1, mercyThreshold: 200, maxChance: 1.0, rarity: 'MYTHICAL' },
  SACRED: { baseChance: 0.06, bonusPerShard: 0.02, mercyThreshold: 12, maxChance: 1.0, rarity: 'LEGENDARY' },
  REMNANT: { baseChance: 0.025, bonusPerShard: 0.01, mercyThreshold: 24, maxChance: 1.0, rarity: 'MYTHICAL' },
};

function round(value: number): number {
  // Avoid floating-point artifacts (e.g. 0.1 + 0.005 = 0.10500000000000001)
  return Math.round(value * 1e6) / 1e6;
}

export interface MercyOptions {
  /** Multiplies baseChance only (e.g. an active 2x event). Defaults to 1 (no change). */
  multiplier?: number;
}

function effectiveBaseChance(config: MercyConfig, options?: MercyOptions): number {
  return config.baseChance * (options?.multiplier ?? 1);
}

/**
 * Chance grows by `bonusPerShard` for every shard opened past `mercyThreshold`
 * (e.g. Void: still base chance at 200 opened, +5% at 201, +10% at 202, ...).
 */
export function calculateDropChance(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): number {
  const config = MERCY_CONFIGS[shardType];
  const shardsPastThreshold = Math.max(0, sinceLastDrop - config.mercyThreshold);
  const chance = effectiveBaseChance(config, options) + shardsPastThreshold * config.bonusPerShard;
  return round(Math.min(chance, config.maxChance));
}

/** Shard count (since last drop) at which the chance first reaches maxChance. */
export function getGuaranteedAt(shardType: ShardType, options?: MercyOptions): number {
  const config = MERCY_CONFIGS[shardType];
  const shardsNeeded = Math.ceil((config.maxChance - effectiveBaseChance(config, options)) / config.bonusPerShard);
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

export function getMercyProgress(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): MercyProgress {
  const config = MERCY_CONFIGS[shardType];
  const guaranteedAt = getGuaranteedAt(shardType, options);
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
