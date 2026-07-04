export type ShardType = 'ANCIENT' | 'VOID' | 'PRIMAL' | 'SACRED' | 'REMNANT';

export const SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'PRIMAL', 'SACRED', 'REMNANT'];

export interface MercyConfig {
  baseChance: number;
  /** Chance added per shard opened once `mercyThreshold` has been passed. */
  bonusPerShard: number;
  /** Shards opened since the last drop before the per-shard mercy bonus starts accruing. */
  mercyThreshold: number;
  maxChance: number;
}
