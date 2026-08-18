ALTER TABLE shard_counters ADD COLUMN since_last_legendary_drop INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shard_counters ADD COLUMN lifetime_legendary_opened INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shard_counters ADD COLUMN lifetime_legendary_drops INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shard_batches ADD COLUMN rarity TEXT CHECK (rarity IN ('LEGENDARY', 'MYTHICAL'));
UPDATE shard_batches SET rarity = 'MYTHICAL' WHERE shard_type = 'PRIMAL';
