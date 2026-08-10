ALTER TABLE shard_batches ADD COLUMN extra_champion_name TEXT;
ALTER TABLE shard_batches ADD COLUMN extra_champion_id INTEGER REFERENCES champions(hero_id);
CREATE INDEX IF NOT EXISTS idx_shard_batches_extra_champion_id ON shard_batches (extra_champion_id);
