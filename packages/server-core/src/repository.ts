import { SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import { client } from './db.js';

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
    sinceLastDrop: Number(row.since_last_drop),
    lifetimeOpened: Number(row.lifetime_opened),
    lifetimeDrops: Number(row.lifetime_drops),
  };
}

const SELECT_COUNTER_SQL = `SELECT shard_type, since_last_drop, lifetime_opened, lifetime_drops
                             FROM shard_counters WHERE profile_id = ? AND shard_type = ?`;

export async function getAllCounters(profileId: number): Promise<ShardCounterRow[]> {
  const rs = await client.execute({
    sql: `SELECT shard_type, since_last_drop, lifetime_opened, lifetime_drops
          FROM shard_counters WHERE profile_id = ?`,
    args: [profileId],
  });
  const rows = rs.rows as unknown as RawCounterRow[];
  const byType = new Map(rows.map((row) => [row.shard_type, row]));
  return SHARD_TYPES.map((shardType) => toShardCounterRow(byType.get(shardType)!));
}

export async function getCounter(profileId: number, shardType: ShardType): Promise<ShardCounterRow> {
  const rs = await client.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
  return toShardCounterRow(rs.rows[0] as unknown as RawCounterRow);
}

export async function addShards(
  profileId: number,
  shardType: ShardType,
  amount: number,
  gotDrop: boolean,
): Promise<ShardCounterRow> {
  const tx = await client.transaction('write');
  try {
    const beforeRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const before = toShardCounterRow(beforeRs.rows[0] as unknown as RawCounterRow);
    const rawAfter = before.sinceLastDrop + amount;
    const after = gotDrop ? 0 : rawAfter;

    await tx.execute({
      sql: `UPDATE shard_counters
            SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
            WHERE profile_id = ? AND shard_type = ?`,
      args: [after, amount, gotDrop ? 1 : 0, profileId, shardType],
    });

    await tx.execute({
      sql: `INSERT INTO shard_batches
              (profile_id, shard_type, action_type, amount, got_drop, since_last_drop_before, since_last_drop_after)
            VALUES (?, ?, 'ADD', ?, ?, ?, ?)`,
      args: [profileId, shardType, amount, gotDrop ? 1 : 0, before.sinceLastDrop, after],
    });

    const afterRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const result = toShardCounterRow(afterRs.rows[0] as unknown as RawCounterRow);

    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function correctSinceLastDrop(
  profileId: number,
  shardType: ShardType,
  value: number,
  gotDrop: boolean,
): Promise<ShardCounterRow> {
  const tx = await client.transaction('write');
  try {
    const beforeRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const before = toShardCounterRow(beforeRs.rows[0] as unknown as RawCounterRow);
    const after = gotDrop ? 0 : value;

    await tx.execute({
      sql: `UPDATE shard_counters
            SET since_last_drop = ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
            WHERE profile_id = ? AND shard_type = ?`,
      args: [after, gotDrop ? 1 : 0, profileId, shardType],
    });

    await tx.execute({
      sql: `INSERT INTO shard_batches
              (profile_id, shard_type, action_type, amount, got_drop, since_last_drop_before, since_last_drop_after)
            VALUES (?, ?, 'CORRECTION', NULL, ?, ?, ?)`,
      args: [profileId, shardType, gotDrop ? 1 : 0, before.sinceLastDrop, after],
    });

    const afterRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const result = toShardCounterRow(afterRs.rows[0] as unknown as RawCounterRow);

    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

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
  return { id: Number(row.id), username: row.username, passwordHash: row.password_hash };
}

export async function getProfileByUsername(username: string): Promise<ProfileRow | undefined> {
  const rs = await client.execute({
    sql: `SELECT id, username, password_hash FROM profiles WHERE username = ?`,
    args: [username],
  });
  const row = rs.rows[0] as unknown as RawProfileRow | undefined;
  return row ? toProfileRow(row) : undefined;
}

export async function getProfileById(id: number): Promise<ProfileRow | undefined> {
  const rs = await client.execute({
    sql: `SELECT id, username, password_hash FROM profiles WHERE id = ?`,
    args: [id],
  });
  const row = rs.rows[0] as unknown as RawProfileRow | undefined;
  return row ? toProfileRow(row) : undefined;
}

export async function createProfile(username: string, passwordHash: string): Promise<ProfileRow> {
  const tx = await client.transaction('write');
  try {
    const insertRs = await tx.execute({
      sql: `INSERT INTO profiles (username, password_hash) VALUES (?, ?)`,
      args: [username, passwordHash],
    });
    const profileId = Number(insertRs.lastInsertRowid);

    for (const shardType of SHARD_TYPES) {
      await tx.execute({
        sql: `INSERT OR IGNORE INTO shard_counters (profile_id, shard_type) VALUES (?, ?)`,
        args: [profileId, shardType],
      });
    }

    await tx.commit();
    return { id: profileId, username, passwordHash };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function createSession(token: string, profileId: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO sessions (token, profile_id) VALUES (?, ?)`,
    args: [token, profileId],
  });
}

export async function getProfileIdBySessionToken(token: string): Promise<number | undefined> {
  const rs = await client.execute({
    sql: `SELECT profile_id FROM sessions WHERE token = ?`,
    args: [token],
  });
  const row = rs.rows[0] as unknown as { profile_id: number } | undefined;
  return row ? Number(row.profile_id) : undefined;
}

export async function deleteSession(token: string): Promise<void> {
  await client.execute({ sql: `DELETE FROM sessions WHERE token = ?`, args: [token] });
}
