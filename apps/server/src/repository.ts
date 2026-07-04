import { SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import { db } from './db.js';

export interface ShardCounterRow {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
}

interface RawCounterRow {
  shard_type: ShardType;
  since_last_drop: number;
  lifetime_opened: number;
  lifetime_drops: number;
}

function toShardCounterRow(row: RawCounterRow): ShardCounterRow {
  return {
    shardType: row.shard_type,
    sinceLastDrop: row.since_last_drop,
    lifetimeOpened: row.lifetime_opened,
    lifetimeDrops: row.lifetime_drops,
  };
}

export function getAllCounters(profileId: number): ShardCounterRow[] {
  const rows = db
    .prepare(
      `SELECT shard_type, since_last_drop, lifetime_opened, lifetime_drops
       FROM shard_counters WHERE profile_id = ?`,
    )
    .all(profileId) as RawCounterRow[];
  const byType = new Map(rows.map((row) => [row.shard_type, row]));
  return SHARD_TYPES.map((shardType) => toShardCounterRow(byType.get(shardType)!));
}

export function getCounter(profileId: number, shardType: ShardType): ShardCounterRow {
  const row = db
    .prepare(
      `SELECT shard_type, since_last_drop, lifetime_opened, lifetime_drops
       FROM shard_counters WHERE profile_id = ? AND shard_type = ?`,
    )
    .get(profileId, shardType) as RawCounterRow;
  return toShardCounterRow(row);
}

const logBatch = db.prepare(
  `INSERT INTO shard_batches
     (profile_id, shard_type, action_type, amount, got_drop, since_last_drop_before, since_last_drop_after)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

export const addShards = db.transaction(
  (profileId: number, shardType: ShardType, amount: number, gotDrop: boolean): ShardCounterRow => {
    const before = getCounter(profileId, shardType);
    const rawAfter = before.sinceLastDrop + amount;
    const after = gotDrop ? 0 : rawAfter;

    db.prepare(
      `UPDATE shard_counters
       SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
       WHERE profile_id = ? AND shard_type = ?`,
    ).run(after, amount, gotDrop ? 1 : 0, profileId, shardType);

    logBatch.run(profileId, shardType, 'ADD', amount, gotDrop ? 1 : 0, before.sinceLastDrop, after);

    return getCounter(profileId, shardType);
  },
);

export const correctSinceLastDrop = db.transaction(
  (profileId: number, shardType: ShardType, value: number, gotDrop: boolean): ShardCounterRow => {
    const before = getCounter(profileId, shardType);
    const after = gotDrop ? 0 : value;

    db.prepare(
      `UPDATE shard_counters
       SET since_last_drop = ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
       WHERE profile_id = ? AND shard_type = ?`,
    ).run(after, gotDrop ? 1 : 0, profileId, shardType);

    logBatch.run(profileId, shardType, 'CORRECTION', null, gotDrop ? 1 : 0, before.sinceLastDrop, after);

    return getCounter(profileId, shardType);
  },
);

export interface ProfileRow {
  id: number;
  username: string;
  passwordHash: string;
}

interface RawProfileRow {
  id: number;
  username: string;
  password_hash: string;
}

function toProfileRow(row: RawProfileRow): ProfileRow {
  return { id: row.id, username: row.username, passwordHash: row.password_hash };
}

export function getProfileByUsername(username: string): ProfileRow | undefined {
  const row = db.prepare(`SELECT id, username, password_hash FROM profiles WHERE username = ?`).get(username) as
    | RawProfileRow
    | undefined;
  return row ? toProfileRow(row) : undefined;
}

export function getProfileById(id: number): ProfileRow | undefined {
  const row = db.prepare(`SELECT id, username, password_hash FROM profiles WHERE id = ?`).get(id) as
    | RawProfileRow
    | undefined;
  return row ? toProfileRow(row) : undefined;
}

const seedCounter = db.prepare(`INSERT OR IGNORE INTO shard_counters (profile_id, shard_type) VALUES (?, ?)`);

export const createProfile = db.transaction((username: string, passwordHash: string): ProfileRow => {
  const info = db
    .prepare(`INSERT INTO profiles (username, password_hash) VALUES (?, ?)`)
    .run(username, passwordHash);
  const profileId = Number(info.lastInsertRowid);

  for (const shardType of SHARD_TYPES) {
    seedCounter.run(profileId, shardType);
  }

  return getProfileById(profileId)!;
});

export function createSession(token: string, profileId: number): void {
  db.prepare(`INSERT INTO sessions (token, profile_id) VALUES (?, ?)`).run(token, profileId);
}

export function getProfileIdBySessionToken(token: string): number | undefined {
  const row = db.prepare(`SELECT profile_id FROM sessions WHERE token = ?`).get(token) as
    | { profile_id: number }
    | undefined;
  return row?.profile_id;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}
