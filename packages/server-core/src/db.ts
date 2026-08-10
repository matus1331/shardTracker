import { createClient } from '@libsql/client';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/rsl.db';

if (DATABASE_URL.startsWith('file:')) {
  const filePath = DATABASE_URL.slice('file:'.length);
  const dir = dirname(filePath);
  if (dir && dir !== '.') {
    mkdirSync(dir, { recursive: true });
  }
}

export const client = createClient({
  url: DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const MIGRATION_FILES = ['001_init.sql', '002_mercy_events.sql', '004_champions.sql'];

// Idempotent (CREATE TABLE/INDEX IF NOT EXISTS) — safe to run on every cold start.
for (const file of MIGRATION_FILES) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', file), 'utf-8');
  await client.executeMultiple(migrationSql);
}

// 003_champion_name.sql and 005_champion_id.sql add columns via ALTER TABLE, which this
// SQLite build doesn't support as `ADD COLUMN IF NOT EXISTS` — guard them with a PRAGMA
// check instead so they stay safe to run on every cold start like the migrations above.
// 004_champions.sql (in MIGRATION_FILES above) must have already created `champions` by
// the time 005 runs, since 005's ALTER references it.
const shardBatchesColumns = await client.execute('PRAGMA table_info(shard_batches)');
const shardBatchesColumnNames = new Set(
  (shardBatchesColumns.rows as unknown as { name: string }[]).map((col) => col.name),
);
if (!shardBatchesColumnNames.has('champion_name')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '003_champion_name.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}
if (!shardBatchesColumnNames.has('champion_id')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '005_champion_id.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}

const mercyEventsColumns = await client.execute('PRAGMA table_info(mercy_events)');
const mercyEventsColumnNames = new Set(
  (mercyEventsColumns.rows as unknown as { name: string }[]).map((col) => col.name),
);
if (!mercyEventsColumnNames.has('kind')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '006_event_kind.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}

if (!shardBatchesColumnNames.has('extra_champion_id')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '007_extra_champion.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}
