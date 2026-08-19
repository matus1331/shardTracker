export type ShardType = 'ANCIENT' | 'VOID' | 'PRIMAL' | 'SACRED' | 'REMNANT';

export const SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'PRIMAL', 'SACRED', 'REMNANT'];

export type Rarity = 'LEGENDARY' | 'MYTHICAL';

export interface MercyConfig {
  baseChance: number;
  /** Chance added per shard opened once `mercyThreshold` has been passed. */
  bonusPerShard: number;
  /** Shards opened since the last drop before the per-shard mercy bonus starts accruing. */
  mercyThreshold: number;
  maxChance: number;
  /** Rarity of champion this mercy track pities toward. */
  rarity: Rarity;
}
