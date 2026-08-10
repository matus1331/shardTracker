# Extra Legendary Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second admin-schedulable event type, "Extra Legendary," which doesn't change drop chance but lets the player log two champions from one shard-opening action, counted correctly everywhere, with its own fire/gold-themed visual indicator distinct from the existing 2x event.

**Architecture:** Extend the existing `mercy_events` table with a `kind` column (`'MULTIPLIER' | 'EXTRA_LEGENDARY'`) instead of a new table, reusing all scheduling/admin plumbing. Extend `shard_batches` with nullable `extra_champion_name`/`extra_champion_id` columns so one confirm-drop action stays one row. `getActiveMercyEvents` already returns at most one event per shard (most-recently-created wins on overlap) regardless of kind — this is the existing fallback for same-kind overlaps and now transparently covers cross-kind overlaps too, so no new overlap-blocking validation is added (see Task 4 note).

**Tech Stack:** Fastify 5 + `@libsql/client` (backend), React 18 + TypeScript + Tailwind CSS v4 (frontend), no test framework in `server-core`/`web` (only `mercy-calc` has vitest — untouched by this plan).

## Global Constraints

- All user-facing text is Czech (see `CLAUDE.md` Localization section) — every new label, button, error message, and placeholder in this plan is already written in Czech; keep it that way if you deviate.
- Extra Legendary events are restricted to Ancient, Void, Sacred shards only (not Primal, not Remnant).
- On a given shard, only one event (of either kind) is ever treated as active at a time — enforced structurally by `getActiveMercyEvents` picking a single most-recent row per shard type, not by new write-time validation.
- Extra Legendary must never affect `currentChance` / mercy progress — `multiplier` is only applied when `activeEvent.kind === 'MULTIPLIER'`.
- After editing anything in `packages/server-core/src`, you must run `npm run build -w @rsl/server-core` before the dev server (or a fresh `apps/server`/`apps/web/api` process) picks up the change — it imports the compiled `dist/`, not live TS (see `CLAUDE.md` "Important workflow gotcha").
- No new automated tests are added in this plan (`server-core` and `apps/web` have no test runner configured) — verification is via `tsc`/build compiling cleanly, `sqlite3` inspection of the local dev DB, and a final manual walkthrough in the browser preview.

---

## File Structure

**Backend (`packages/server-core/src`):**
- `migrations/006_event_kind.sql` (new) — adds `mercy_events.kind`.
- `migrations/007_extra_champion.sql` (new) — adds `shard_batches.extra_champion_name`/`extra_champion_id`.
- `db.ts` (modify) — guards to run the two new migrations on existing DBs.
- `repository.ts` (modify) — `MercyEventRow`/`createMercyEvent` gain `kind`; `correctSinceLastDrop`/`DropRow`/`listDrops` gain the extra champion + resolved event kind.
- `routes/events.ts` (modify) — `kind` in the scheduling payload, shard-type allowlist depends on `kind`.
- `routes/shards.ts` (modify) — `withChance` only applies `multiplier` for `kind === 'MULTIPLIER'`; PUT route accepts `extraChampionName`.

**Frontend (`apps/web/src`):**
- `types.ts` (modify) — `ActiveMercyEvent.kind`, `DropRecord.extraChampionName`/`extraChampionUrl`/`eventKind`.
- `utils/eventBadge.ts` (new) — shared fire/gold badge + accent classes for the Extra Legendary indicator, used by both `ShardCard` and `HistoryTab`.
- `utils/formatEventCountdown.ts` (modify) — takes an event label instead of hardcoding "2x event".
- `api/eventsClient.ts` (modify) — `MercyEvent.kind`, `createEvent(..., kind)`.
- `api/client.ts` (modify) — `correctSinceLastDrop(..., extraChampionName)`.
- `hooks/useShardData.ts` (modify) — `confirmDrop(..., extraChampionName)`.
- `components/ChampionAutocompleteField.tsx` (new) — extracted single-champion autocomplete input, used twice by the modal.
- `components/DropCelebrationModal.tsx` (modify) — renders a second "Extra lego" field when the active event is `EXTRA_LEGENDARY`.
- `components/ShardCard.tsx` (modify) — badge/border/countdown branch on event kind; wires the new modal prop.
- `components/EventsAdminModal.tsx` (modify) — event-kind toggle, shard-list restriction, per-group kind tag.
- `components/Dashboard.tsx` (modify) — admin button title/aria-label generalized from "Spravovat 2x eventy" to "Spravovat eventy".
- `components/HistoryTab.tsx` (modify) — second champion chip + kind-specific tag.

---

### Task 1: Database migrations for event kind and extra champion

**Files:**
- Create: `packages/server-core/src/migrations/006_event_kind.sql`
- Create: `packages/server-core/src/migrations/007_extra_champion.sql`
- Modify: `packages/server-core/src/db.ts`

**Interfaces:**
- Produces: `mercy_events.kind TEXT NOT NULL DEFAULT 'MULTIPLIER' CHECK (kind IN ('MULTIPLIER', 'EXTRA_LEGENDARY'))`, `shard_batches.extra_champion_name TEXT`, `shard_batches.extra_champion_id INTEGER REFERENCES champions(hero_id)` — every later task in this plan reads/writes these columns.

- [ ] **Step 1: Create the `kind` column migration**

```sql
ALTER TABLE mercy_events ADD COLUMN kind TEXT NOT NULL DEFAULT 'MULTIPLIER' CHECK (kind IN ('MULTIPLIER', 'EXTRA_LEGENDARY'));
```

Save as `packages/server-core/src/migrations/006_event_kind.sql`.

- [ ] **Step 2: Create the extra-champion columns migration**

```sql
ALTER TABLE shard_batches ADD COLUMN extra_champion_name TEXT;
ALTER TABLE shard_batches ADD COLUMN extra_champion_id INTEGER REFERENCES champions(hero_id);
CREATE INDEX IF NOT EXISTS idx_shard_batches_extra_champion_id ON shard_batches (extra_champion_id);
```

Save as `packages/server-core/src/migrations/007_extra_champion.sql`.

- [ ] **Step 3: Wire up guarded execution in `db.ts`**

Read `packages/server-core/src/db.ts` first. After the existing block that checks `shardBatchesColumnNames` and conditionally runs `003_champion_name.sql`/`005_champion_id.sql` (the last lines of the file), add:

```ts
const mercyEventsColumns = await client.execute('PRAGMA table_info(mercy_events)');
const mercyEventsColumnNames = new Set(
  (mercyEventsColumns.rows as unknown as { name: string }[]).map((col) => col.name),
);
if (!mercyEventsColumnNames.has('kind')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '006_event_kind.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}

if (!shardBatchesColumnNames.has('extra_champion_name')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '007_extra_champion.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}
```

This follows the exact guard pattern already used for `003`/`005` in the same file (SQLite's `ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`, so existence is checked via `PRAGMA table_info` first).

- [ ] **Step 4: Rebuild server-core and verify migrations apply**

```bash
npm run build -w @rsl/server-core
rm -f apps/server/data/rsl.db*
npm run dev:server &
sleep 2
sqlite3 apps/server/data/rsl.db "PRAGMA table_info(mercy_events);"
sqlite3 apps/server/data/rsl.db "PRAGMA table_info(shard_batches);"
kill %1
```

Expected: `mercy_events` table_info output includes a `kind` row; `shard_batches` table_info output includes `extra_champion_name` and `extra_champion_id` rows. (Deleting the local dev DB file first is safe — it's gitignored, disposable local data, not the production Turso DB.)

- [ ] **Step 5: Commit**

```bash
git add packages/server-core/src/migrations/006_event_kind.sql packages/server-core/src/migrations/007_extra_champion.sql packages/server-core/src/db.ts
git commit -m "Add kind column to mercy_events and extra champion columns to shard_batches"
```

---

### Task 2: Repository support for event kind

**Files:**
- Modify: `packages/server-core/src/repository.ts:318-404` (the `MercyEventRow`/`RawMercyEventRow`/`toMercyEventRow`/`MERCY_EVENT_COLUMNS`/`createMercyEvent` block)

**Interfaces:**
- Consumes: `client` (libSQL client, `packages/server-core/src/db.ts`), the `kind` column from Task 1.
- Produces: `MercyEventRow.kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY'`, `createMercyEvent(shardTypes, startAt, endAt, label, kind): Promise<string>` — consumed by `routes/events.ts` (Task 4) and `routes/shards.ts` (Task 5).

- [ ] **Step 1: Add `kind` to the event row types**

In `packages/server-core/src/repository.ts`, update the `MercyEventRow` interface (currently lines 318-326):

```ts
export interface MercyEventRow {
  id: number;
  groupId: string;
  shardType: ShardType;
  startAt: string;
  endAt: string;
  multiplier: number;
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY';
  label: string | null;
}
```

Update `RawMercyEventRow` (currently lines 328-336):

```ts
interface RawMercyEventRow {
  id: number;
  group_id: string;
  shard_type: ShardType;
  start_at: string;
  end_at: string;
  multiplier: number;
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY';
  label: string | null;
}
```

Update `toMercyEventRow` (currently lines 338-348) to map the new field:

```ts
function toMercyEventRow(row: RawMercyEventRow): MercyEventRow {
  return {
    id: Number(row.id),
    groupId: row.group_id,
    shardType: row.shard_type,
    startAt: row.start_at,
    endAt: row.end_at,
    multiplier: Number(row.multiplier),
    kind: row.kind,
    label: row.label,
  };
}
```

Update `MERCY_EVENT_COLUMNS` (currently line 350):

```ts
const MERCY_EVENT_COLUMNS = 'id, group_id, shard_type, start_at, end_at, multiplier, kind, label';
```

- [ ] **Step 2: Add `kind` parameter to `createMercyEvent`**

Replace the existing `createMercyEvent` function (currently lines 382-404):

```ts
export async function createMercyEvent(
  shardTypes: ShardType[],
  startAt: string,
  endAt: string,
  label: string | null,
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY',
): Promise<string> {
  const groupId = randomUUID();
  const multiplier = kind === 'EXTRA_LEGENDARY' ? 1.0 : 2.0;
  const tx = await client.transaction('write');
  try {
    for (const shardType of shardTypes) {
      await tx.execute({
        sql: `INSERT INTO mercy_events (group_id, shard_type, start_at, end_at, multiplier, label, kind)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [groupId, shardType, startAt, endAt, multiplier, label, kind],
      });
    }
    await tx.commit();
    return groupId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
```

- [ ] **Step 3: Rebuild and verify it compiles**

```bash
npm run build -w @rsl/server-core
```

Expected: compiles with no errors. (`routes/events.ts` will fail to compile until Task 4 updates its call site — that's expected and fixed next task; if you see an error there, confirm it's specifically about the `createMercyEvent` call missing the new `kind` argument, not something else in this file.)

- [ ] **Step 4: Commit**

```bash
git add packages/server-core/src/repository.ts
git commit -m "Add event kind to MercyEventRow and createMercyEvent"
```

---

### Task 3: Repository support for the extra champion on a drop

**Files:**
- Modify: `packages/server-core/src/repository.ts:85-180` (`correctSinceLastDrop`, `DropRow`, `RawDropRow`, `listDrops`)

**Interfaces:**
- Consumes: `championPoolWhereClause(shardType)` (existing, `repository.ts:189-193`, unchanged).
- Produces: `correctSinceLastDrop(profileId, shardType, value, gotDrop, championName?, extraChampionName?): Promise<ShardCounterRow>`, `DropRow.extraChampionName`, `DropRow.extraChampionUrl`, `DropRow.eventKind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null` — consumed by `routes/shards.ts` (Task 5) and `routes/drops.ts` (which maps `DropRow` to the API response — no changes needed there since it spreads `...drop`).

- [ ] **Step 1: Extend `correctSinceLastDrop` with an extra champion**

Replace the existing `correctSinceLastDrop` function (currently lines 85-137):

```ts
export async function correctSinceLastDrop(
  profileId: number,
  shardType: ShardType,
  value: number,
  gotDrop: boolean,
  championName?: string | null,
  extraChampionName?: string | null,
): Promise<ShardCounterRow> {
  const tx = await client.transaction('write');
  try {
    const beforeRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const before = toShardCounterRow(beforeRs.rows[0] as unknown as RawCounterRow);
    const after = gotDrop ? 0 : value;
    const lifetimeDelta = value - before.sinceLastDrop;
    const dropCount = gotDrop ? (extraChampionName ? 2 : 1) : 0;

    await tx.execute({
      sql: `UPDATE shard_counters
            SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
            WHERE profile_id = ? AND shard_type = ?`,
      args: [after, lifetimeDelta, dropCount, profileId, shardType],
    });

    // Exact, case-insensitive match (COLLATE NOCASE on champions.name) scoped to this shard
    // type's summon pool — the route layer already rejects a championName that isn't in the
    // pool, so this should always resolve when championName is set; it stays a lookup
    // (rather than trusting a passed-in id) so this function is the single place that
    // decides what counts as a valid link.
    let championId: number | null = null;
    if (championName) {
      const championRs = await tx.execute({
        sql: `SELECT hero_id FROM champions WHERE ${championPoolWhereClause(shardType)} AND name = ?`,
        args: [championName],
      });
      const championRow = championRs.rows[0] as unknown as { hero_id: number } | undefined;
      championId = championRow ? Number(championRow.hero_id) : null;
    }

    let extraChampionId: number | null = null;
    if (extraChampionName) {
      const extraChampionRs = await tx.execute({
        sql: `SELECT hero_id FROM champions WHERE ${championPoolWhereClause(shardType)} AND name = ?`,
        args: [extraChampionName],
      });
      const extraChampionRow = extraChampionRs.rows[0] as unknown as { hero_id: number } | undefined;
      extraChampionId = extraChampionRow ? Number(extraChampionRow.hero_id) : null;
    }

    await tx.execute({
      sql: `INSERT INTO shard_batches
              (profile_id, shard_type, action_type, amount, got_drop, since_last_drop_before, since_last_drop_after, champion_name, champion_id, extra_champion_name, extra_champion_id)
            VALUES (?, ?, 'CORRECTION', NULL, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        profileId,
        shardType,
        gotDrop ? 1 : 0,
        before.sinceLastDrop,
        after,
        championName ?? null,
        championId,
        extraChampionName ?? null,
        extraChampionId,
      ],
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
```

Note the `lifetime_drops` increment changed from the literal `gotDrop ? 1 : 0` to `dropCount` (`gotDrop ? (extraChampionName ? 2 : 1) : 0`) — this is the "+2 in statistics" requirement from the spec, applied at the single point where lifetime drops are counted.

- [ ] **Step 2: Extend `DropRow`/`RawDropRow`/`listDrops` with the extra champion and resolved event kind**

Replace the existing `DropRow` interface, `RawDropRow` interface, and `listDrops` function (currently lines 139-180):

```ts
export interface DropRow {
  shardType: ShardType;
  createdAt: string;
  seriesNumber: number;
  championName: string | null;
  championUrl: string | null;
  extraChampionName: string | null;
  extraChampionUrl: string | null;
  duringEvent: boolean;
  eventKind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null;
}

interface RawDropRow {
  shard_type: ShardType;
  created_at: string;
  since_last_drop_before: number;
  champion_name: string | null;
  champion_url: string | null;
  extra_champion_name: string | null;
  extra_champion_url: string | null;
  event_kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null;
}

export async function listDrops(profileId: number): Promise<DropRow[]> {
  const rs = await client.execute({
    sql: `SELECT sb.shard_type, sb.created_at, sb.since_last_drop_before,
                 sb.champion_name, c.hellhades_url AS champion_url,
                 sb.extra_champion_name, ec.hellhades_url AS extra_champion_url,
                 (
                   SELECT me.kind FROM mercy_events me
                   WHERE me.shard_type = sb.shard_type
                     AND datetime(me.start_at) <= datetime(sb.created_at)
                     AND datetime(me.end_at) >= datetime(sb.created_at)
                   ORDER BY me.id DESC
                   LIMIT 1
                 ) AS event_kind
          FROM shard_batches sb
          LEFT JOIN champions c ON c.hero_id = sb.champion_id
          LEFT JOIN champions ec ON ec.hero_id = sb.extra_champion_id
          WHERE sb.profile_id = ? AND sb.got_drop = 1
          ORDER BY sb.created_at DESC, sb.id DESC`,
    args: [profileId],
  });
  return (rs.rows as unknown as RawDropRow[]).map((row) => ({
    shardType: row.shard_type,
    createdAt: row.created_at,
    seriesNumber: Number(row.since_last_drop_before),
    championName: row.champion_name,
    championUrl: row.champion_url,
    extraChampionName: row.extra_champion_name,
    extraChampionUrl: row.extra_champion_url,
    duringEvent: row.event_kind !== null,
    eventKind: row.event_kind,
  }));
}
```

The scalar subquery replaces the old boolean `EXISTS` check with the actual `kind` of the most-recently-created matching event (same "most recent wins" tie-break as `getActiveMercyEvents`), so `duringEvent` is now derived from it (`event_kind !== null`) instead of being computed separately.

- [ ] **Step 3: Rebuild and verify it compiles**

```bash
npm run build -w @rsl/server-core
```

Expected: compiles with no errors. `routes/shards.ts` will now fail (it calls `correctSinceLastDrop` with the old 5-arg signature) — that's fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add packages/server-core/src/repository.ts
git commit -m "Add extra champion and resolved event kind to drop repository functions"
```

---

### Task 4: Event scheduling route accepts `kind`

**Files:**
- Modify: `packages/server-core/src/routes/events.ts`

**Interfaces:**
- Consumes: `createMercyEvent(shardTypes, startAt, endAt, label, kind)` from Task 2.
- Produces: `POST /api/events` accepts `kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY'` in the body (defaults to `'MULTIPLIER'` if omitted) — consumed by `apps/web/src/api/eventsClient.ts` (Task 6).

- [ ] **Step 1: Add a kind-aware shard-type allowlist and validation**

Read `packages/server-core/src/routes/events.ts` first (it's short, 64 lines). Replace its full contents:

```ts
import type { FastifyInstance } from 'fastify';
import { type ShardType } from '@rsl/mercy-calc';
import { isAdminUsername } from '../admin.js';
import { createMercyEvent, deleteMercyEventGroup, getProfileById, listMercyEvents } from '../repository.js';

type EventKind = 'MULTIPLIER' | 'EXTRA_LEGENDARY';

const SUPPORTED_EVENT_SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'PRIMAL', 'SACRED'];
const EXTRA_LEGENDARY_SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'SACRED'];

function isSupportedEventShardType(value: unknown, kind: EventKind): value is ShardType {
  const allowed = kind === 'EXTRA_LEGENDARY' ? EXTRA_LEGENDARY_SHARD_TYPES : SUPPORTED_EVENT_SHARD_TYPES;
  return typeof value === 'string' && (allowed as string[]).includes(value);
}

/** UTC ISO 8601 datetime, e.g. '2026-07-24T08:00:00Z'. Also rejects calendar-invalid dates (e.g. month 13). */
function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

export async function eventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.profileId) {
      return reply.code(401).send({ error: 'Nepřihlášený' });
    }
    const profile = await getProfileById(request.profileId);
    if (!profile || !isAdminUsername(profile.username)) {
      return reply.code(403).send({ error: 'Nemáš oprávnění spravovat eventy' });
    }
  });

  app.get('/api/events', async () => {
    return listMercyEvents();
  });

  app.post<{ Body: { shardTypes?: unknown[]; startAt?: string; endAt?: string; label?: string; kind?: string } }>(
    '/api/events',
    async (request, reply) => {
      const { shardTypes, startAt, endAt, label, kind: rawKind } = request.body ?? {};
      const kind: EventKind = rawKind === 'EXTRA_LEGENDARY' ? 'EXTRA_LEGENDARY' : 'MULTIPLIER';

      if (!Array.isArray(shardTypes) || shardTypes.length === 0) {
        return reply.code(400).send({ error: 'Vyber alespoň jeden shard' });
      }
      for (const shardType of shardTypes) {
        if (!isSupportedEventShardType(shardType, kind)) {
          return reply.code(400).send({
            error:
              kind === 'EXTRA_LEGENDARY'
                ? 'Neplatný typ shardu pro Extra Legendary event'
                : 'Neplatný typ shardu pro 2x event',
          });
        }
      }
      if (!isIsoDateTime(startAt) || !isIsoDateTime(endAt) || Date.parse(startAt) >= Date.parse(endAt)) {
        return reply
          .code(400)
          .send({ error: 'Začátek musí předcházet konci (formát ISO 8601 UTC, např. 2026-07-24T08:00:00Z)' });
      }

      const groupId = await createMercyEvent(shardTypes as ShardType[], startAt, endAt, label?.trim() || null, kind);
      return { groupId };
    },
  );

  app.delete<{ Params: { groupId: string } }>('/api/events/:groupId', async (request) => {
    await deleteMercyEventGroup(request.params.groupId);
    return { ok: true };
  });
}
```

**Note on overlap validation:** this deliberately does not add a check rejecting overlapping event windows for the same shard. The pre-existing codebase never validated this for same-kind overlaps either (see the comment on `getActiveMercyEvents` in `repository.ts`) — it just resolves ties by "most recently created wins" at read time. That resolution is kind-agnostic (the query doesn't filter by `kind`), so it already guarantees only one event is ever treated as active per shard, satisfying the "only one event at a time" requirement without new write-time validation code.

- [ ] **Step 2: Rebuild and verify it compiles**

```bash
npm run build -w @rsl/server-core
```

Expected: compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/server-core/src/routes/events.ts
git commit -m "Support scheduling Extra Legendary events via kind field"
```

---

### Task 5: Shard routes gate the multiplier by kind and accept the extra champion

**Files:**
- Modify: `packages/server-core/src/routes/shards.ts`

**Interfaces:**
- Consumes: `correctSinceLastDrop(..., extraChampionName?)` from Task 3, `MercyEventRow.kind` from Task 2, `isChampionInShardPool(shardType, name)` (existing, `repository.ts:201-207`, unchanged).
- Produces: `GET/POST/PUT /api/shards*` responses include `activeEvent: { multiplier, endAt, label, kind } | null`, with `currentChance`/mercy progress unaffected by `EXTRA_LEGENDARY` events. `PUT /api/shards/:shardType/since-last-drop` accepts `extraChampionName` in the body — consumed by `apps/web/src/api/client.ts` (Task 6).

- [ ] **Step 1: Gate the multiplier by event kind in `withChance`**

Read `packages/server-core/src/routes/shards.ts` first (it's short, 89 lines). Replace its full contents:

```ts
import type { FastifyInstance } from 'fastify';
import { calculateDropChance, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import {
  addShards,
  correctSinceLastDrop,
  getActiveMercyEvents,
  getAllCounters,
  isChampionInShardPool,
  type MercyEventRow,
  type ShardCounterRow,
} from '../repository.js';

function isShardType(value: string): value is ShardType {
  return (SHARD_TYPES as string[]).includes(value);
}

function withChance(row: ShardCounterRow, activeEvents: Map<ShardType, MercyEventRow>) {
  const activeEvent = activeEvents.get(row.shardType);
  const multiplier = activeEvent?.kind === 'MULTIPLIER' ? activeEvent.multiplier : 1;
  return {
    ...row,
    currentChance: calculateDropChance(row.shardType, row.sinceLastDrop, { multiplier }),
    activeEvent: activeEvent
      ? { multiplier: activeEvent.multiplier, endAt: activeEvent.endAt, label: activeEvent.label, kind: activeEvent.kind }
      : null,
  };
}

export async function shardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.profileId) {
      return reply.code(401).send({ error: 'Nepřihlášený' });
    }
  });

  app.get('/api/shards', async (request) => {
    const counters = await getAllCounters(request.profileId!);
    const activeEvents = await getActiveMercyEvents(SHARD_TYPES);
    return counters.map((row) => withChance(row, activeEvents));
  });

  app.post<{ Params: { shardType: string }; Body: { amount?: number; gotDrop?: boolean } }>(
    '/api/shards/:shardType/add',
    async (request, reply) => {
      const { shardType } = request.params;
      const { amount, gotDrop = false } = request.body ?? {};

      if (!isShardType(shardType)) {
        return reply.code(400).send({ error: 'Invalid shardType' });
      }
      if (!Number.isInteger(amount) || (amount as number) < 1) {
        return reply.code(400).send({ error: 'amount must be an integer >= 1' });
      }

      const updated = await addShards(request.profileId!, shardType, amount as number, gotDrop);
      const activeEvents = await getActiveMercyEvents([shardType]);
      return withChance(updated, activeEvents);
    },
  );

  app.put<{
    Params: { shardType: string };
    Body: { value?: number; gotDrop?: boolean; championName?: string; extraChampionName?: string };
  }>('/api/shards/:shardType/since-last-drop', async (request, reply) => {
    const { shardType } = request.params;
    const { value, gotDrop = false, championName, extraChampionName } = request.body ?? {};

    if (!isShardType(shardType)) {
      return reply.code(400).send({ error: 'Invalid shardType' });
    }
    if (!Number.isInteger(value) || (value as number) < 0) {
      return reply.code(400).send({ error: 'value must be an integer >= 0' });
    }

    const trimmedChampionName = championName?.trim().slice(0, 80) || null;
    if (trimmedChampionName && !(await isChampionInShardPool(shardType, trimmedChampionName))) {
      return reply.code(400).send({ error: 'Invalid championName for this shard type' });
    }

    const trimmedExtraChampionName = extraChampionName?.trim().slice(0, 80) || null;
    if (trimmedExtraChampionName) {
      if (!gotDrop) {
        return reply.code(400).send({ error: 'extraChampionName requires gotDrop' });
      }
      if (!(await isChampionInShardPool(shardType, trimmedExtraChampionName))) {
        return reply.code(400).send({ error: 'Invalid extraChampionName for this shard type' });
      }
    }

    const updated = await correctSinceLastDrop(
      request.profileId!,
      shardType,
      value as number,
      gotDrop,
      trimmedChampionName,
      trimmedExtraChampionName,
    );
    const activeEvents = await getActiveMercyEvents([shardType]);
    return withChance(updated, activeEvents);
  });
}
```

- [ ] **Step 2: Rebuild and verify it compiles**

```bash
npm run build -w @rsl/server-core
```

Expected: compiles with no errors — this is the last backend file, so the whole `server-core` package should now build cleanly end to end.

- [ ] **Step 3: Manual smoke test against the running dev server**

```bash
rm -f apps/server/data/rsl.db*
npm run dev:server &
sleep 2
curl -s -c /tmp/rsl-cookies.txt -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"plantest","password":"testpass123"}'
curl -s -b /tmp/rsl-cookies.txt http://localhost:3001/api/shards
kill %1
```

Expected: the register call returns `{"username":"plantest","isAdmin":false}`, and `GET /api/shards` returns an array of 5 shard counters, each with `"activeEvent":null` and a `"currentChance"` number. This confirms `withChance` still works with no events scheduled (the `kind`-gating branch is exercised for the empty/no-event case here; Task 11 exercises the `EXTRA_LEGENDARY` branch end to end once the admin UI exists).

- [ ] **Step 4: Commit**

```bash
git add packages/server-core/src/routes/shards.ts
git commit -m "Gate 2x multiplier by event kind and accept extra champion on drop"
```

---

### Task 6: Frontend types, event badge styling, and API client updates

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/utils/formatEventCountdown.ts`
- Create: `apps/web/src/utils/eventBadge.ts`
- Modify: `apps/web/src/api/eventsClient.ts`
- Modify: `apps/web/src/api/client.ts`

**Interfaces:**
- Consumes: nothing new (pure types/utils/API-client layer, matches the backend response shapes from Tasks 2-5).
- Produces: `ActiveMercyEvent.kind`, `DropRecord.extraChampionName`/`extraChampionUrl`/`eventKind`, `formatEventCountdown(endAt, label)`, `EXTRA_LEGENDARY_BADGE_CLASS`/`EXTRA_LEGENDARY_BADGE_LABEL`/`EXTRA_LEGENDARY_CARD_ACCENT_CLASS`/`EXTRA_LEGENDARY_TEXT_CLASS`, `MercyEvent.kind`, `createEvent(shardTypes, startAt, endAt, label, kind)`, `correctSinceLastDrop(shardType, value, gotDrop, championName?, extraChampionName?)` — all consumed by Tasks 7-10.

- [ ] **Step 1: Add `kind` and extra-champion fields to `types.ts`**

In `apps/web/src/types.ts`, replace the `ActiveMercyEvent` interface (currently lines 3-8):

```ts
export interface ActiveMercyEvent {
  multiplier: number;
  /** ISO 8601 UTC datetime, e.g. '2026-07-27T08:00:00Z'. */
  endAt: string;
  label: string | null;
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY';
}
```

Replace the `DropRecord` interface (currently lines 19-30):

```ts
export interface DropRecord {
  shardType: ShardType;
  /** ISO 8601 UTC datetime. */
  createdAt: string;
  /** Which shard in the series (since the previous drop) this one landed on. */
  seriesNumber: number;
  championName: string | null;
  /** Link to the champion's HellHades detail/rating page, if the name matched a known champion. */
  championUrl: string | null;
  /** Bonus champion from an active Extra Legendary event, if the player reported one. */
  extraChampionName: string | null;
  extraChampionUrl: string | null;
  duringEvent: boolean;
  eventKind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null;
  mercyActive: boolean;
}
```

- [ ] **Step 2: Generalize `formatEventCountdown` to take an event label**

Replace the full contents of `apps/web/src/utils/formatEventCountdown.ts`:

```ts
function pluralize(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

/** `endAt` is an ISO 8601 UTC datetime, e.g. '2026-07-27T08:00:00Z'. `label` is the event name prefix, e.g. '2x event' or 'Extra Legendary event'. */
export function formatEventCountdown(endAt: string, label: string): string {
  const diffMs = new Date(endAt).getTime() - Date.now();

  if (diffMs <= 0) return `${label} · končí za chvíli`;

  const diffHours = Math.ceil(diffMs / 3_600_000);
  if (diffHours < 24) {
    return `${label} · končí za ${diffHours} ${pluralize(diffHours, 'hodinu', 'hodiny', 'hodin')}`;
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `${label} · končí za ${diffDays} ${pluralize(diffDays, 'den', 'dny', 'dní')}`;
}
```

- [ ] **Step 3: Create the shared Extra Legendary badge styling**

Create `apps/web/src/utils/eventBadge.ts`:

```ts
/**
 * Fire/gold palette for the Extra Legendary event indicator — deliberately fixed
 * (not shard-color-matched like the 2x event's border) so the event has one
 * consistent visual identity across Ancient/Void/Sacred, and is unmistakably
 * distinct from the amber/yellow "⚡ 2×" indicator at a glance.
 */
export const EXTRA_LEGENDARY_BADGE_LABEL = '🔥 EXTRA LEGO';

export const EXTRA_LEGENDARY_BADGE_CLASS =
  'animate-pulse rounded-full bg-gradient-to-r from-orange-500 to-red-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-[0_0_8px_1px_rgba(249,115,22,0.6)] motion-reduce:animate-none';

export const EXTRA_LEGENDARY_CARD_ACCENT_CLASS = 'border-orange-500 shadow-[0_0_18px_3px_rgba(249,115,22,0.5)]';

export const EXTRA_LEGENDARY_TEXT_CLASS = 'text-orange-400';
```

- [ ] **Step 4: Add `kind` to the events API client**

Replace the full contents of `apps/web/src/api/eventsClient.ts`:

```ts
import type { ShardType } from '@rsl/mercy-calc';

export interface MercyEvent {
  id: number;
  groupId: string;
  shardType: ShardType;
  /** ISO 8601 UTC datetime, e.g. '2026-07-24T08:00:00Z'. */
  startAt: string;
  endAt: string;
  multiplier: number;
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY';
  label: string | null;
}

async function handleEventsResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Požadavek se nezdařil');
  }
  return res.json();
}

export function fetchEvents(): Promise<MercyEvent[]> {
  return fetch('/api/events', { credentials: 'include' }).then((res) => handleEventsResponse<MercyEvent[]>(res));
}

export function createEvent(
  shardTypes: ShardType[],
  startAt: string,
  endAt: string,
  label: string,
  kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY',
): Promise<{ groupId: string }> {
  return fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ shardTypes, startAt, endAt, label: label.trim() || undefined, kind }),
  }).then((res) => handleEventsResponse<{ groupId: string }>(res));
}

export function deleteEventGroup(groupId: string): Promise<void> {
  return fetch(`/api/events/${groupId}`, { method: 'DELETE', credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Smazání se nezdařilo');
  });
}
```

- [ ] **Step 5: Add `extraChampionName` to the shards API client**

In `apps/web/src/api/client.ts`, replace the `correctSinceLastDrop` function:

```ts
export function correctSinceLastDrop(
  shardType: ShardType,
  value: number,
  gotDrop: boolean,
  championName?: string,
  extraChampionName?: string,
): Promise<ShardCounterState> {
  return fetch(`/api/shards/${shardType}/since-last-drop`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value, gotDrop, championName, extraChampionName }),
  }).then(handleResponse);
}
```

(Leave `handleResponse`, `fetchShards`, and `addShards` untouched.)

- [ ] **Step 6: Verify the frontend still type-checks**

```bash
npx tsc -p apps/web/tsconfig.json --noEmit
```

Expected: errors only in `ShardCard.tsx` (calls `formatEventCountdown` with one argument) — that's fixed in Task 9. No errors in `types.ts`, `utils/`, or `api/`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/utils/formatEventCountdown.ts apps/web/src/utils/eventBadge.ts apps/web/src/api/eventsClient.ts apps/web/src/api/client.ts
git commit -m "Add event kind and extra champion to frontend types, utils, and API clients"
```

---

### Task 7: Admin UI — schedule Extra Legendary events

**Files:**
- Modify: `apps/web/src/components/EventsAdminModal.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx:58-59`

**Interfaces:**
- Consumes: `createEvent(shardTypes, startAt, endAt, label, kind)`, `MercyEvent.kind` from Task 6.
- Produces: nothing new consumed by later tasks (admin UI is a leaf).

- [ ] **Step 1: Add a kind toggle and kind-dependent shard list**

Read `apps/web/src/components/EventsAdminModal.tsx` first (287 lines). Make these changes:

Add `'MULTIPLIER' | 'EXTRA_LEGENDARY'` kind state and restrict the shard list when Extra Legendary is selected. Replace the top of the component (from the `EventGroup` interface through the `EventsAdminModalProps`/constants block, currently lines 10-20) with:

```ts
type EventKind = 'MULTIPLIER' | 'EXTRA_LEGENDARY';

const LEGENDARY_SHARDS: ShardType[] = ['ANCIENT', 'VOID', 'SACRED'];
const MYTHICAL_SHARDS: ShardType[] = ['PRIMAL'];
const MULTIPLIER_SHARD_TYPES: ShardType[] = [...LEGENDARY_SHARDS, ...MYTHICAL_SHARDS];

interface EventGroup {
  groupId: string;
  shardTypes: ShardType[];
  startAt: string;
  endAt: string;
  label: string | null;
  kind: EventKind;
}
```

Update `groupEvents` (currently lines 26-40) to carry `kind` through (a group's rows always share one `kind` since they're created together):

```ts
function groupEvents(events: MercyEvent[]): EventGroup[] {
  const byGroup = new Map<string, MercyEvent[]>();
  for (const event of events) {
    const list = byGroup.get(event.groupId) ?? [];
    list.push(event);
    byGroup.set(event.groupId, list);
  }
  return Array.from(byGroup.values()).map((rows) => ({
    groupId: rows[0].groupId,
    shardTypes: rows.map((r) => r.shardType),
    startAt: rows[0].startAt,
    endAt: rows[0].endAt,
    label: rows[0].label,
    kind: rows[0].kind,
  }));
}
```

- [ ] **Step 2: Add kind state, reset shard selection when it changes, and gate the shard checkbox list**

In the component body, after the existing `const [events, setEvents] = useState<MercyEvent[] | null>(null);` line (currently line 74), add:

```ts
const [kind, setKind] = useState<EventKind>('MULTIPLIER');
```

Replace the shard-selection UI block (currently lines 145-174, from `<p className="mb-1.5 text-xs text-slate-400">Shardy</p>` through the closing `</div>` of the checkbox list) with:

```tsx
<div className="mb-3 flex gap-1.5">
  <button
    type="button"
    onClick={() => {
      setKind('MULTIPLIER');
      setSelected(new Set());
    }}
    className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
      kind === 'MULTIPLIER'
        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
        : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
    }`}
  >
    ⚡ 2x event
  </button>
  <button
    type="button"
    onClick={() => {
      setKind('EXTRA_LEGENDARY');
      setSelected(new Set());
    }}
    className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
      kind === 'EXTRA_LEGENDARY'
        ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
        : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
    }`}
  >
    🔥 Extra Legendary event
  </button>
</div>

<p className="mb-1.5 text-xs text-slate-400">Shardy</p>
{kind === 'MULTIPLIER' && (
  <div className="mb-2 flex flex-wrap gap-1.5">
    <button
      type="button"
      onClick={() => setSelected(new Set(LEGENDARY_SHARDS))}
      className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
    >
      Legendary
    </button>
    <button
      type="button"
      onClick={() => setSelected(new Set(MYTHICAL_SHARDS))}
      className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
    >
      Mythical
    </button>
  </div>
)}
<div className="mb-3 flex flex-wrap gap-3">
  {(kind === 'EXTRA_LEGENDARY' ? LEGENDARY_SHARDS : MULTIPLIER_SHARD_TYPES).map((shardType) => (
    <label key={shardType} className="flex items-center gap-1.5 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={selected.has(shardType)}
        onChange={() => toggleShard(shardType)}
        className="h-3.5 w-3.5"
      />
      {SHARD_META[shardType].label}
    </label>
  ))}
</div>
```

- [ ] **Step 3: Pass `kind` when creating the event and reset it after submit**

Replace `handleCreate` (currently lines 107-122):

```ts
const handleCreate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (selected.size === 0 || !rangeValid) return;
  setSubmitting(true);
  setError(null);
  try {
    await createEvent(Array.from(selected), startAt, endAt, label, kind);
    setSelected(new Set());
    setLabel('');
    load();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Vytvoření se nezdařilo');
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 4: Update the modal title, submit button, and per-group kind tag**

Replace the static title paragraph (currently line 142, `<p className="mb-4 text-sm font-semibold">Naplánovat 2x event</p>`):

```tsx
<p className="mb-4 text-sm font-semibold">
  Naplánovat {kind === 'EXTRA_LEGENDARY' ? 'Extra Legendary event' : '2x event'}
</p>
```

Replace the submit button (currently lines 230-236):

```tsx
<button
  type="submit"
  disabled={selected.size === 0 || !rangeValid || submitting}
  className={`h-9 w-full rounded-lg border px-3.5 disabled:cursor-not-allowed disabled:opacity-50 ${
    kind === 'EXTRA_LEGENDARY'
      ? 'border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
  }`}
>
  {submitting ? 'Ukládám…' : 'Naplánovat event'}
</button>
```

Replace the group list item (currently lines 244-271) to show a kind tag and use kind-appropriate active-state colors:

```tsx
<li
  key={group.groupId}
  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
    isActiveNow(group.startAt, group.endAt)
      ? group.kind === 'EXTRA_LEGENDARY'
        ? 'border-orange-500/50 bg-orange-500/10 text-orange-200'
        : 'border-amber-500/50 bg-amber-500/10 text-amber-200'
      : 'border-slate-800 bg-slate-800/50 text-slate-400'
  }`}
>
  <div>
    <p className="font-medium">
      {group.kind === 'EXTRA_LEGENDARY' ? '🔥 Extra Legendary' : '⚡ 2x'} —{' '}
      {group.shardTypes.map((s) => SHARD_META[s].label).join(', ')}
      {group.label ? ` — ${group.label}` : ''}
    </p>
    <p>
      {formatUtcDateTime(group.startAt)} → {formatUtcDateTime(group.endAt)}
    </p>
    <p className="text-slate-500">
      tvůj čas: {formatLocalDateTime(group.startAt)} → {formatLocalDateTime(group.endAt)}
    </p>
  </div>
  <button
    type="button"
    onClick={() => handleDelete(group.groupId)}
    className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:bg-red-500/20 hover:text-red-300"
  >
    Smazat
  </button>
</li>
```

- [ ] **Step 5: Generalize the Dashboard admin button copy**

In `apps/web/src/components/Dashboard.tsx`, replace lines 58-59:

```tsx
title="Spravovat eventy"
aria-label="Spravovat eventy"
```

- [ ] **Step 6: Verify it type-checks**

```bash
npx tsc -p apps/web/tsconfig.json --noEmit
```

Expected: no new errors from `EventsAdminModal.tsx` or `Dashboard.tsx` (the pre-existing `ShardCard.tsx` error from Task 6 Step 6 is still expected here).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/EventsAdminModal.tsx apps/web/src/components/Dashboard.tsx
git commit -m "Add Extra Legendary event scheduling to the admin modal"
```

---

### Task 8: Extract a reusable champion autocomplete field and add the second "Extra lego" field

**Files:**
- Create: `apps/web/src/components/ChampionAutocompleteField.tsx`
- Modify: `apps/web/src/components/DropCelebrationModal.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ChampionAutocompleteField` component (props below), `DropCelebrationModal` props `extraLegendaryActive: boolean` and `onConfirm: (championName: string, extraChampionName: string) => Promise<void>` — consumed by `ShardCard.tsx` (Task 9).

- [ ] **Step 1: Extract `ChampionAutocompleteField`**

Read `apps/web/src/components/DropCelebrationModal.tsx` first (140 lines) — the `findMatches` function and the whole autocomplete `<label>...</label>` block (lines 14-20 and 72-117) are what's being extracted.

Create `apps/web/src/components/ChampionAutocompleteField.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_VISIBLE_MATCHES = 8;

function findMatches(query: string, suggestions: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return suggestions.slice(0, MAX_VISIBLE_MATCHES);
  const startsWith = suggestions.filter((s) => s.toLowerCase().startsWith(q));
  const contains = suggestions.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
  return [...startsWith, ...contains].slice(0, MAX_VISIBLE_MATCHES);
}

interface ChampionAutocompleteFieldProps {
  label: string;
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  /** Called whenever the "typed name doesn't match a known champion" state changes, so the parent can gate its submit button. */
  onUnknownChange: (unknown: boolean) => void;
  /** Extra class applied to the input's border/focus ring, for visually tying a field to an active event (e.g. the Extra Legendary fire accent). */
  accentClass?: string;
}

export function ChampionAutocompleteField({
  label,
  suggestions,
  value,
  onChange,
  disabled,
  onUnknownChange,
  accentClass,
}: ChampionAutocompleteFieldProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedName = value.trim();
  const isKnownChampion = useMemo(
    () => suggestions.some((s) => s.toLowerCase() === trimmedName.toLowerCase()),
    [suggestions, trimmedName],
  );
  const matches = useMemo(() => findMatches(value, suggestions), [value, suggestions]);
  const showUnknownWarning = trimmedName !== '' && !isKnownChampion;

  useEffect(() => {
    onUnknownChange(showUnknownWarning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUnknownWarning]);

  const selectSuggestion = (name: string) => {
    onChange(name);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  return (
    <label className="mb-1.5 block text-left">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
          disabled={disabled}
          placeholder="Začni psát jméno…"
          maxLength={80}
          autoComplete="off"
          className={`h-9 w-full rounded-lg border bg-slate-800 px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none ${
            accentClass ?? 'border-slate-700 focus:border-slate-500'
          }`}
        />
        {dropdownOpen && (
          <ul className="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg">
            {matches.length > 0 ? (
              matches.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(name);
                    }}
                    className="block w-full px-2.5 py-1.5 text-left text-sm text-slate-100 hover:bg-slate-700"
                  >
                    {name}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2.5 py-1.5 text-left text-xs text-slate-500">Takové lego v seznamu není</li>
            )}
          </ul>
        )}
      </div>
      <p className={`mt-1.5 h-3.5 text-left text-[11px] ${showUnknownWarning ? 'text-amber-400' : 'invisible'}`}>
        Takové lego v seznamu není
      </p>
    </label>
  );
}
```

- [ ] **Step 2: Rewrite `DropCelebrationModal` to use it and add the "Extra lego" field**

Replace the full contents of `apps/web/src/components/DropCelebrationModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { fetchChampionSuggestions } from '../api/dropsClient';
import { ChampionAutocompleteField } from './ChampionAutocompleteField';
import { EXTRA_LEGENDARY_TEXT_CLASS } from '../utils/eventBadge';

interface DropCelebrationModalProps {
  title: string;
  shardType: ShardType;
  extraLegendaryActive: boolean;
  onConfirm: (championName: string, extraChampionName: string) => Promise<void>;
  onCancel: () => void;
}

export function DropCelebrationModal({
  title,
  shardType,
  extraLegendaryActive,
  onConfirm,
  onCancel,
}: DropCelebrationModalProps) {
  const [championName, setChampionName] = useState('');
  const [extraChampionName, setExtraChampionName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [primaryUnknown, setPrimaryUnknown] = useState(false);
  const [extraUnknown, setExtraUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChampionSuggestions(shardType)
      .then(setSuggestions)
      .catch(() => {});
  }, [shardType]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(championName.trim(), extraChampionName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset se nezdařil');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/55" onClick={onCancel}>
      <div
        className="w-80 rounded-xl border border-slate-700 bg-slate-900 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-3xl">🎉</p>
        <p className="mb-2 text-base font-semibold">{title}</p>
        <p className="mb-4 text-sm text-slate-400">
          Chceš teď vynulovat svůj Shard Tracker a začít počítat Mercy counter od nuly?
        </p>
        <ChampionAutocompleteField
          label="Jméno šampiona (nepovinné)"
          suggestions={suggestions}
          value={championName}
          onChange={setChampionName}
          disabled={submitting}
          onUnknownChange={setPrimaryUnknown}
        />
        {extraLegendaryActive && (
          <>
            <p className={`mb-1 text-left text-[11px] font-semibold ${EXTRA_LEGENDARY_TEXT_CLASS}`}>
              🔥 Extra Legendary event aktivní — padly dvě lega?
            </p>
            <ChampionAutocompleteField
              label="Extra lego (nepovinné)"
              suggestions={suggestions}
              value={extraChampionName}
              onChange={setExtraChampionName}
              disabled={submitting}
              onUnknownChange={setExtraUnknown}
              accentClass="border-orange-500/40 focus:border-orange-400"
            />
          </>
        )}
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || primaryUnknown || extraUnknown}
            className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Resetuji…' : 'Ano, resetovat'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Note `extraUnknown` starts `false` and can only become `true` via `ChampionAutocompleteField`'s `onUnknownChange` callback firing — which only happens while that field is mounted. Since it's not rendered at all when `extraLegendaryActive` is `false`, `extraUnknown` can never block the submit button in that case, so no extra `extraLegendaryActive` check is needed in the `disabled` expression.

- [ ] **Step 3: Verify it type-checks**

```bash
npx tsc -p apps/web/tsconfig.json --noEmit
```

Expected: no errors from `ChampionAutocompleteField.tsx` or `DropCelebrationModal.tsx` (the pre-existing `ShardCard.tsx` errors remain, fixed next task).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ChampionAutocompleteField.tsx apps/web/src/components/DropCelebrationModal.tsx
git commit -m "Extract champion autocomplete field and add optional Extra lego field"
```

---

### Task 9: Shard card badge/border/countdown by event kind, and wire the extra champion through

**Files:**
- Modify: `apps/web/src/components/ShardCard.tsx`
- Modify: `apps/web/src/hooks/useShardData.ts`

**Interfaces:**
- Consumes: `ActiveMercyEvent.kind` (Task 6), `EXTRA_LEGENDARY_*` constants (Task 6), `formatEventCountdown(endAt, label)` (Task 6), `DropCelebrationModal`'s new props (Task 8).
- Produces: `ShardCardProps.onConfirmDrop: (shardType, championName, extraChampionName?) => Promise<void>`, `useShardData().confirmDrop(shardType, championName, extraChampionName?)` — `Dashboard.tsx` needs no change since it passes `confirmDrop` straight through and the new parameter is optional.

- [ ] **Step 1: Update `useShardData.confirmDrop`**

In `apps/web/src/hooks/useShardData.ts`, replace the `confirmDrop` callback:

```ts
const confirmDrop = useCallback(
  async (shardType: ShardType, championName: string, extraChampionName?: string) => {
    const current = shards?.find((s) => s.shardType === shardType);
    const updated = await correctSinceLastDrop(
      shardType,
      current?.sinceLastDrop ?? 0,
      true,
      championName,
      extraChampionName,
    );
    setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
  },
  [shards],
);
```

- [ ] **Step 2: Branch the badge, border, and countdown on `activeEvent.kind` in `ShardCard`**

Read `apps/web/src/components/ShardCard.tsx` first (156 lines). Replace the imports (currently lines 1-10):

```tsx
import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { getMercyProgress, MERCY_CONFIGS } from '@rsl/mercy-calc';
import type { ShardCounterState } from '../types';
import { SHARD_META } from '../types';
import { MercyProgressBar } from './MercyProgressBar';
import { LogShardsForm } from './LogShardsForm';
import { EditCountModal } from './EditCountModal';
import { DropCelebrationModal } from './DropCelebrationModal';
import { formatEventCountdown } from '../utils/formatEventCountdown';
import {
  EXTRA_LEGENDARY_BADGE_CLASS,
  EXTRA_LEGENDARY_BADGE_LABEL,
  EXTRA_LEGENDARY_CARD_ACCENT_CLASS,
  EXTRA_LEGENDARY_TEXT_CLASS,
} from '../utils/eventBadge';
```

Replace the `ShardCardProps` interface (currently lines 12-17):

```ts
interface ShardCardProps {
  data: ShardCounterState;
  onLog: (shardType: ShardType, amount: number, gotDrop: boolean) => Promise<void>;
  onCorrect: (shardType: ShardType, value: number, gotDrop: boolean) => Promise<void>;
  onConfirmDrop: (shardType: ShardType, championName: string, extraChampionName?: string) => Promise<void>;
}
```

Replace the mercy-progress calculation (currently lines 43-47) to only pass the multiplier for `MULTIPLIER`-kind events:

```ts
const isMultiplierEvent = data.activeEvent?.kind === 'MULTIPLIER';
const isExtraLegendaryEvent = data.activeEvent?.kind === 'EXTRA_LEGENDARY';
const { mercyThreshold, guaranteedAt, mercyActive, preMercyProgress, mercyProgress } = getMercyProgress(
  data.shardType,
  data.sinceLastDrop,
  { multiplier: isMultiplierEvent ? data.activeEvent!.multiplier : 1 },
);
```

Replace the card's outer `className` (currently lines 57-60) to use the fire accent for Extra Legendary:

```tsx
className={`rounded-xl bg-slate-900 p-4 ${
  isExtraLegendaryEvent
    ? `border-2 ${EXTRA_LEGENDARY_CARD_ACCENT_CLASS}`
    : isMultiplierEvent
      ? `border-2 ${meta.eventAccentClass}`
      : `border border-slate-800 border-l-[3px] ${meta.borderClass}`
}`}
```

Replace the badge block (currently lines 67-72):

```tsx
<div className="flex items-center gap-1.5">
  {isMultiplierEvent && (
    <span className="animate-pulse rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-900 shadow-[0_0_8px_1px_rgba(251,191,36,0.6)] motion-reduce:animate-none">
      ⚡ 2×
    </span>
  )}
  {isExtraLegendaryEvent && <span className={EXTRA_LEGENDARY_BADGE_CLASS}>{EXTRA_LEGENDARY_BADGE_LABEL}</span>}
  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${meta.pillClass}`}>
    {meta.dropLabel}
  </span>
</div>
```

Replace the chance-display block (currently lines 79-90) so the strikethrough/arrow only shows for `MULTIPLIER` events (Extra Legendary never changes the chance, so showing "X% → X%" would be pointless):

```tsx
<div className="mb-1.5 flex items-baseline gap-1.5">
  {isMultiplierEvent && (
    <>
      <span className="text-sm text-slate-500 line-through tabular-nums">{baseChancePct}%</span>
      <span className="text-sm text-slate-500">→</span>
    </>
  )}
  <span className="text-2xl font-bold tabular-nums">{currentChancePct}%</span>
  <span className="text-[11px] whitespace-nowrap text-slate-500">
    {mercyActive ? 'mercy aktivní' : 'aktuální šance'}
  </span>
</div>
```

Replace the countdown line (currently line 103):

```tsx
<span className={isExtraLegendaryEvent ? EXTRA_LEGENDARY_TEXT_CLASS : 'text-amber-400'}>
  {data.activeEvent
    ? formatEventCountdown(data.activeEvent.endAt, isExtraLegendaryEvent ? 'Extra Legendary event' : '2x event')
    : ''}
</span>
```

Replace the `DropCelebrationModal` usage (currently lines 142-152) to pass the new props:

```tsx
{celebrating && (
  <DropCelebrationModal
    title={meta.celebrationTitle}
    shardType={data.shardType}
    extraLegendaryActive={isExtraLegendaryEvent}
    onCancel={() => setCelebrating(false)}
    onConfirm={async (championName, extraChampionName) => {
      await onConfirmDrop(data.shardType, championName, extraChampionName || undefined);
      setCelebrating(false);
    }}
  />
)}
```

- [ ] **Step 3: Verify the whole frontend now type-checks cleanly**

```bash
npx tsc -p apps/web/tsconfig.json --noEmit
```

Expected: no errors anywhere in `apps/web/src` — this is the last consumer of every type/prop introduced so far.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ShardCard.tsx apps/web/src/hooks/useShardData.ts
git commit -m "Show Extra Legendary badge/accent on shard cards and wire the extra champion field"
```

---

### Task 10: History tab shows the extra champion and the correct event tag

**Files:**
- Modify: `apps/web/src/components/HistoryTab.tsx`

**Interfaces:**
- Consumes: `DropRecord.extraChampionName`/`extraChampionUrl`/`eventKind` (Task 6), `EXTRA_LEGENDARY_BADGE_CLASS`/`EXTRA_LEGENDARY_BADGE_LABEL` (Task 6).
- Produces: nothing consumed elsewhere (leaf component).

- [ ] **Step 1: Replace the `duringEvent` tag with a kind-specific one, and show the extra champion**

Read `apps/web/src/components/HistoryTab.tsx` first (120 lines). Add the import:

```ts
import { EXTRA_LEGENDARY_BADGE_CLASS, EXTRA_LEGENDARY_BADGE_LABEL } from '../utils/eventBadge';
```

Replace the event tag block inside `DropRow` (currently lines 40-44):

```tsx
{drop.eventKind === 'MULTIPLIER' && (
  <span className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-900">
    ⚡ 2×
  </span>
)}
{drop.eventKind === 'EXTRA_LEGENDARY' && (
  <span className={EXTRA_LEGENDARY_BADGE_CLASS}>{EXTRA_LEGENDARY_BADGE_LABEL}</span>
)}
```

Replace the champion-name display block (currently lines 46-64, the `<div className="flex shrink-0 items-center gap-3 text-xs">...</div>`) to also show the extra champion as a second chip when present:

```tsx
<div className="flex shrink-0 items-center gap-3 text-xs">
  <div className="flex items-center gap-2">
    {drop.championUrl ? (
      <a
        href={drop.championUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Zobrazit šampiona na HellHades"
        className="flex items-center gap-1 text-slate-300 hover:text-slate-100 hover:underline"
      >
        <span>{drop.championName}</span>
        <ExternalLinkIcon />
      </a>
    ) : (
      <span className={drop.championName ? 'text-slate-300' : 'text-slate-500 italic'}>
        {drop.championName || meta.genericChampionLabel}
      </span>
    )}
    {drop.extraChampionName &&
      (drop.extraChampionUrl ? (
        <a
          href={drop.extraChampionUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Zobrazit šampiona na HellHades"
          className="flex items-center gap-1 text-orange-300 hover:text-orange-200 hover:underline"
        >
          <span>+ {drop.extraChampionName}</span>
          <ExternalLinkIcon />
        </a>
      ) : (
        <span className="text-orange-300">+ {drop.extraChampionName}</span>
      ))}
  </div>
  <span className="text-slate-500 tabular-nums">{formatDateTime(drop.createdAt)}</span>
</div>
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc -p apps/web/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/HistoryTab.tsx
git commit -m "Show extra champion and Extra Legendary tag in drop history"
```

---

### Task 11: End-to-end manual verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Rebuild everything and start both dev servers**

```bash
npm run build -w @rsl/mercy-calc -w @rsl/server-core
rm -f apps/server/data/rsl.db*
npm run dev
```

Leave this running in the foreground of a dedicated terminal/background job.

- [ ] **Step 2: Open the app in the browser preview and register an admin account**

Use the Browser preview tool to open `http://localhost:5173`, register a new account, then set that same username as `ADMIN_USERNAME` for the local server process (e.g. `ADMIN_USERNAME=<your-test-username> npm run dev:server`, restarting just the server piece) so the lightning-bolt admin button appears on the dashboard. Log back in if needed.

- [ ] **Step 3: Schedule an Extra Legendary event for Ancient**

Click the admin (lightning bolt) button, switch the toggle to "🔥 Extra Legendary event", confirm the shard checkboxes now only show Ancient/Void/Sacred, select Ancient, set a start time in the past and an end time a few hours in the future (both UTC), submit. Confirm the scheduled-events list shows the new group tagged "🔥 Extra Legendary" and highlighted as active.

- [ ] **Step 4: Confirm the shard card shows the new indicator and unchanged chance**

Close the admin modal. On the Ancient shard card, confirm: the orange/red "🔥 EXTRA LEGO" badge is visible and pulsing, the card border/glow is orange (not Ancient's usual blue), the countdown text reads "Extra Legendary event · končí za …" in orange, and the displayed chance percentage has no strikethrough/arrow (i.e. looks identical to how it'd look with no event active).

- [ ] **Step 5: Log a double-legendary drop and verify the extra field appears**

Click the celebration ("Padlo mi lego! 🎉") button on the Ancient card. Confirm a second field labeled "Extra lego (nepovinné)" appears below the primary champion field, with the "🔥 Extra Legendary event aktivní" hint above it. Type a known champion name in both fields (use the autocomplete dropdown to pick valid names) and confirm.

- [ ] **Step 6: Verify the counters and history reflect two drops**

Confirm the Ancient card's mercy counter reset to 0 (since-last-drop). Open the History & Stats page (via the history icon), switch to the History tab, and confirm the new row shows both champion names (the second one prefixed with `+` in orange) and the "🔥 EXTRA LEGO" tag instead of "⚡ 2×". Switch to the Stats tab and confirm the Ancient shard's `lifetimeDrops`-derived numbers (visible via the Luck Index card's "Skutečně N" text) increased by 2 for this single action, not 1.

- [ ] **Step 7: Verify a plain 2x event still behaves exactly as before**

Schedule a regular 2x event (toggle back to "⚡ 2x event") for a different shard (e.g. Void), confirm its card shows the original amber "⚡ 2×" badge, shard-colored (violet) border, strikethrough chance, and that logging a drop there does NOT show an "Extra lego" field — confirming the two event kinds are fully independent and the pre-existing 2x behavior is unchanged.

- [ ] **Step 8: Clean up the local test DB**

```bash
rm -f apps/server/data/rsl.db*
```

This step has no commit — it's a verification pass over the previous 10 tasks' combined behavior, not a code change.
