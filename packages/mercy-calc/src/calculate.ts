import type { MercyConfig, ShardType } from './types.js';

export const MERCY_CONFIGS: Record<ShardType, MercyConfig> = {
  ANCIENT: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0, rarity: 'LEGENDARY' },
  VOID: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0, rarity: 'LEGENDARY' },
  PRIMAL: { baseChance: 0.005, bonusPerShard: 0.1, mercyThreshold: 200, maxChance: 1.0, rarity: 'MYTHICAL' },
  SACRED: { baseChance: 0.06, bonusPerShard: 0.02, mercyThreshold: 12, maxChance: 1.0, rarity: 'LEGENDARY' },
  REMNANT: { baseChance: 0.025, bonusPerShard: 0.01, mercyThreshold: 24, maxChance: 1.0, rarity: 'MYTHICAL' },
};

/** Primal's second, independent mercy track — a Legendary can drop from Primal shards
 * alongside the shard's main Mythical pity. Mercy starts after 75 shards without a
 * Legendary, then +1%/shard, guaranteed at 174. Tracked separately from MERCY_CONFIGS.PRIMAL. */
export const PRIMAL_LEGENDARY_MERCY_CONFIG: MercyConfig = {
  baseChance: 0.01,
  bonusPerShard: 0.01,
  mercyThreshold: 75,
  maxChance: 1.0,
  rarity: 'LEGENDARY',
};

function round(value: number): number {
  // Avoid floating-point artifacts (e.g. 0.1 + 0.005 = 0.10500000000000001)
  return Math.round(value * 1e6) / 1e6;
}

export interface MercyOptions {
  /** Multiplies baseChance only (e.g. an active 2x event). Defaults to 1 (no change). */
  multiplier?: number;
}

function effectiveBaseChanceForConfig(config: MercyConfig, options?: MercyOptions): number {
  return config.baseChance * (options?.multiplier ?? 1);
}

/**
 * Chance grows by `config.bonusPerShard` for every shard opened past `config.mercyThreshold`.
 * This is the core formula; `calculateDropChance` below is a `ShardType`-keyed convenience
 * wrapper around it for the common single-track case.
 */
export function calculateDropChanceForConfig(config: MercyConfig, sinceLastDrop: number, options?: MercyOptions): number {
  const shardsPastThreshold = Math.max(0, sinceLastDrop - config.mercyThreshold);
  const chance = effectiveBaseChanceForConfig(config, options) + shardsPastThreshold * config.bonusPerShard;
  return round(Math.min(chance, config.maxChance));
}

/** Shard count (since last drop) at which the chance first reaches maxChance. */
export function getGuaranteedAtForConfig(config: MercyConfig, options?: MercyOptions): number {
  const shardsNeeded = Math.ceil((config.maxChance - effectiveBaseChanceForConfig(config, options)) / config.bonusPerShard);
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

export function getMercyProgressForConfig(config: MercyConfig, sinceLastDrop: number, options?: MercyOptions): MercyProgress {
  const guaranteedAt = getGuaranteedAtForConfig(config, options);
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

export function calculateDropChance(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): number {
  return calculateDropChanceForConfig(MERCY_CONFIGS[shardType], sinceLastDrop, options);
}

export function getGuaranteedAt(shardType: ShardType, options?: MercyOptions): number {
  return getGuaranteedAtForConfig(MERCY_CONFIGS[shardType], options);
}

export function getMercyProgress(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): MercyProgress {
  return getMercyProgressForConfig(MERCY_CONFIGS[shardType], sinceLastDrop, options);
}
