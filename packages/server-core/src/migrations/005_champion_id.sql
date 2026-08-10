ALTER TABLE shard_batches ADD COLUMN champion_id INTEGER REFERENCES champions(hero_id);
CREATE INDEX IF NOT EXISTS idx_shard_batches_champion_id ON shard_batches (champion_id);
