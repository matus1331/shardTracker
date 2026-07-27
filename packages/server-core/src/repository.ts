import { randomUUID } from 'node:crypto';
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
  championName?: string | null,
): Promise<ShardCounterRow> {
  const tx = await client.transaction('write');
  try {
    const beforeRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const before = toShardCounterRow(beforeRs.rows[0] as unknown as RawCounterRow);
    const after = gotDrop ? 0 : value;
    const lifetimeDelta = value - before.sinceLastDrop;

    await tx.execute({
      sql: `UPDATE shard_counters
            SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
            WHERE profile_id = ? AND shard_type = ?`,
      args: [after, lifetimeDelta, gotDrop ? 1 : 0, profileId, shardType],
    });

    await tx.execute({
      sql: `INSERT INTO shard_batches
              (profile_id, shard_type, action_type, amount, got_drop, since_last_drop_before, since_last_drop_after, champion_name)
            VALUES (?, ?, 'CORRECTION', NULL, ?, ?, ?, ?)`,
      args: [profileId, shardType, gotDrop ? 1 : 0, before.sinceLastDrop, after, championName ?? null],
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

export interface DropRow {
  shardType: ShardType;
  createdAt: string;
  seriesNumber: number;
  championName: string | null;
  duringEvent: boolean;
}

interface RawDropRow {
  shard_type: ShardType;
  created_at: string;
  since_last_drop_before: number;
  champion_name: string | null;
  during_event: number;
}

export async function listDrops(profileId: number): Promise<DropRow[]> {
  const rs = await client.execute({
    sql: `SELECT sb.shard_type, sb.created_at, sb.since_last_drop_before, sb.champion_name,
                 EXISTS (
                   SELECT 1 FROM mercy_events me
                   WHERE me.shard_type = sb.shard_type
                     AND datetime(me.start_at) <= datetime(sb.created_at)
                     AND datetime(me.end_at) >= datetime(sb.created_at)
                 ) AS during_event
          FROM shard_batches sb
          WHERE sb.profile_id = ? AND sb.got_drop = 1
          ORDER BY sb.created_at DESC, sb.id DESC`,
    args: [profileId],
  });
  return (rs.rows as unknown as RawDropRow[]).map((row) => ({
    shardType: row.shard_type,
    createdAt: row.created_at,
    seriesNumber: Number(row.since_last_drop_before),
    championName: row.champion_name,
    duringEvent: Boolean(Number(row.during_event)),
  }));
}

export async function listChampionNames(profileId: number, shardType: ShardType): Promise<string[]> {
  const rs = await client.execute({
    sql: `SELECT DISTINCT champion_name FROM shard_batches
          WHERE profile_id = ? AND shard_type = ? AND champion_name IS NOT NULL
          ORDER BY champion_name`,
    args: [profileId, shardType],
  });
  return (rs.rows as unknown as { champion_name: string }[]).map((row) => row.champion_name);
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

export interface MercyEventRow {
  id: number;
  groupId: string;
  shardType: ShardType;
  startAt: string;
  endAt: string;
  multiplier: number;
  label: string | null;
}

interface RawMercyEventRow {
  id: number;
  group_id: string;
  shard_type: ShardType;
  start_at: string;
  end_at: string;
  multiplier: number;
  label: string | null;
}

function toMercyEventRow(row: RawMercyEventRow): MercyEventRow {
  return {
    id: Number(row.id),
    groupId: row.group_id,
    shardType: row.shard_type,
    startAt: row.start_at,
    endAt: row.end_at,
    multiplier: Number(row.multiplier),
    label: row.label,
  };
}

const MERCY_EVENT_COLUMNS = 'id, group_id, shard_type, start_at, end_at, multiplier, label';

export async function listMercyEvents(): Promise<MercyEventRow[]> {
  const rs = await client.execute(
    `SELECT ${MERCY_EVENT_COLUMNS} FROM mercy_events ORDER BY start_at DESC, id DESC`,
  );
  return (rs.rows as unknown as RawMercyEventRow[]).map(toMercyEventRow);
}

/**
 * Returns the currently-active event (if any) per shard type. `datetime(...)` normalizes
 * both the stored ISO 8601 UTC strings and SQLite's own `now` through the same parser, so
 * exact separator/format differences don't cause false negatives. If two events for the
 * same shard type overlap right now (not expected in normal admin use), the
 * most-recently-created one wins.
 */
export async function getActiveMercyEvents(shardTypes: ShardType[]): Promise<Map<ShardType, MercyEventRow>> {
  const placeholders = shardTypes.map(() => '?').join(', ');
  const rs = await client.execute({
    sql: `SELECT ${MERCY_EVENT_COLUMNS} FROM mercy_events
          WHERE shard_type IN (${placeholders}) AND datetime(start_at) <= datetime('now') AND datetime(end_at) >= datetime('now')
          ORDER BY id DESC`,
    args: shardTypes,
  });
  const map = new Map<ShardType, MercyEventRow>();
  for (const raw of rs.rows as unknown as RawMercyEventRow[]) {
    const row = toMercyEventRow(raw);
    if (!map.has(row.shardType)) map.set(row.shardType, row);
  }
  return map;
}

export async function createMercyEvent(
  shardTypes: ShardType[],
  startAt: string,
  endAt: string,
  label: string | null,
): Promise<string> {
  const groupId = randomUUID();
  const tx = await client.transaction('write');
  try {
    for (const shardType of shardTypes) {
      await tx.execute({
        sql: `INSERT INTO mercy_events (group_id, shard_type, start_at, end_at, multiplier, label)
              VALUES (?, ?, ?, ?, 2.0, ?)`,
        args: [groupId, shardType, startAt, endAt, label],
      });
    }
    await tx.commit();
    return groupId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function deleteMercyEventGroup(groupId: string): Promise<void> {
  await client.execute({ sql: `DELETE FROM mercy_events WHERE group_id = ?`, args: [groupId] });
}
