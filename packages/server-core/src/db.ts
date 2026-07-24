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

const MIGRATION_FILES = ['001_init.sql', '002_mercy_events.sql'];

// Idempotent (CREATE TABLE/INDEX IF NOT EXISTS) — safe to run on every cold start.
for (const file of MIGRATION_FILES) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', file), 'utf-8');
  await client.executeMultiple(migrationSql);
}
