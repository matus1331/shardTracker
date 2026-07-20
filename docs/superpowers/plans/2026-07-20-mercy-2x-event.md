# 2x Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one admin (identified by username) schedule "2x" drop-rate events for ANCIENT/VOID/PRIMAL/SACRED shards over a date range, have the mercy formula and the dashboard automatically reflect the doubled base chance while active, and make the boost clearly visible on the affected shard cards.

**Architecture:** A new `mercy_events` table (one row per shard type per event, rows sharing a `group_id`) is the source of truth for scheduling. `packages/mercy-calc`'s three exported functions gain an optional `{ multiplier }` option that only scales `baseChance`. The server resolves "is an event active today" once per `/api/shards` request and embeds the result (`activeEvent`) directly in each shard's API response, so the frontend never independently fetches or date-matches events — it only renders what the server already decided. Admin-only CRUD routes let the admin manage events through a modal; regular users only ever see the read-only effect.

**Tech Stack:** Fastify 5 route handlers, `@libsql/client` (Turso/libSQL) via the existing `client.transaction('write')` pattern, `node:crypto`'s `randomUUID` for `group_id`, React 18 + TypeScript + Tailwind for the frontend, Vitest for `packages/mercy-calc` (the only package with automated tests in this repo).

## Global Constraints

- Supported event shard types are **only** `ANCIENT`, `VOID`, `PRIMAL`, `SACRED` — `REMNANT` must never appear in the `mercy_events` `CHECK` constraint, the admin form, or any event-related validation.
- A multiplier only ever scales `baseChance`. `bonusPerShard` and `mercyThreshold` are never touched.
- `MERCY_CONFIGS` in `packages/mercy-calc/src/calculate.ts` remains the single source of truth for per-shard numbers — the multiplier is a pure runtime overlay, never a schema change to that config.
- Admin identification is via `process.env.ADMIN_USERNAME` compared to the logged-in profile's username — no `is_admin` DB column.
- All new user-facing copy is Czech (per `CLAUDE.md`'s localization convention), including backend error strings that reach the UI.
- `packages/mercy-calc` is the only package with an automated test suite (Vitest) in this repo — `packages/server-core` and `apps/web` changes are verified manually via the dev server (curl / browser), matching existing project practice. Do not introduce new test infrastructure for those packages as part of this feature.
- `packages/server-core` and `packages/mercy-calc` ship compiled `dist/` output — after editing their `src/`, rerun `npm run build -w @rsl/mercy-calc -w @rsl/server-core` before the dev servers (or manual curl checks) will see the change, per `CLAUDE.md`'s "Local dev" gotcha.

---

### Task 1: `packages/mercy-calc` — multiplier option on the mercy formula

**Files:**
- Modify: `packages/mercy-calc/src/calculate.ts`
- Modify: `packages/mercy-calc/src/calculate.test.ts`
- Modify: `packages/mercy-calc/src/index.ts`

**Interfaces:**
- Produces: `MercyOptions { multiplier?: number }`, and `calculateDropChance(shardType, sinceLastDrop, options?: MercyOptions): number`, `getGuaranteedAt(shardType, options?: MercyOptions): number`, `getMercyProgress(shardType, sinceLastDrop, options?: MercyOptions): MercyProgress` — all three now accept an optional third/second argument that everything downstream (server-core, frontend) will use to apply an active event's multiplier.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block at the end of `packages/mercy-calc/src/calculate.test.ts` (after the existing `getMercyProgress` block):

```ts
describe('multiplier option (2x event support)', () => {
  it('doubles only the base chance, leaving bonusPerShard and threshold untouched', () => {
    expect(calculateDropChance('ANCIENT', 0, { multiplier: 2 })).toBeCloseTo(0.01);
    expect(calculateDropChance('ANCIENT', 200, { multiplier: 2 })).toBeCloseTo(0.01);
    expect(calculateDropChance('ANCIENT', 201, { multiplier: 2 })).toBeCloseTo(0.06);
    expect(calculateDropChance('SACRED', 0, { multiplier: 2 })).toBeCloseTo(0.12);
    expect(calculateDropChance('SACRED', 13, { multiplier: 2 })).toBeCloseTo(0.14);
  });

  it('caps at 100% the same way as without a multiplier', () => {
    expect(calculateDropChance('ANCIENT', 220, { multiplier: 2 })).toBe(1.0);
  });

  it('defaults to multiplier 1 when the option is omitted (no behavior change)', () => {
    expect(calculateDropChance('SACRED', 13)).toBeCloseTo(0.08);
  });

  it('shifts guaranteedAt earlier when the base chance is doubled', () => {
    expect(getGuaranteedAt('SACRED')).toBe(59);
    expect(getGuaranteedAt('SACRED', { multiplier: 2 })).toBe(56);
    expect(getGuaranteedAt('ANCIENT', { multiplier: 2 })).toBe(220);
  });

  it('getMercyProgress reflects the multiplier-adjusted guaranteedAt', () => {
    const progress = getMercyProgress('SACRED', 56, { multiplier: 2 });
    expect(progress.guaranteedAt).toBe(56);
    expect(progress.mercyActive).toBe(true);
    expect(progress.mercyProgress).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @rsl/mercy-calc`

Expected: FAIL — the new assertions get the un-multiplied base values (e.g.
`calculateDropChance('ANCIENT', 0, { multiplier: 2 })` returns `0.005`, not `0.01`)
because the third argument is currently accepted-and-ignored by JS at runtime.

- [ ] **Step 3: Implement the multiplier option**

Replace the full contents of `packages/mercy-calc/src/calculate.ts` with:

```ts
import type { MercyConfig, ShardType } from './types.js';

export const MERCY_CONFIGS: Record<ShardType, MercyConfig> = {
  ANCIENT: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0 },
  VOID: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0 },
  PRIMAL: { baseChance: 0.005, bonusPerShard: 0.1, mercyThreshold: 200, maxChance: 1.0 },
  SACRED: { baseChance: 0.06, bonusPerShard: 0.02, mercyThreshold: 12, maxChance: 1.0 },
  REMNANT: { baseChance: 0.025, bonusPerShard: 0.01, mercyThreshold: 24, maxChance: 1.0 },
};

function round(value: number): number {
  // Avoid floating-point artifacts (e.g. 0.1 + 0.005 = 0.10500000000000001)
  return Math.round(value * 1e6) / 1e6;
}

export interface MercyOptions {
  /** Multiplies baseChance only (e.g. an active 2x event). Defaults to 1 (no change). */
  multiplier?: number;
}

function effectiveBaseChance(config: MercyConfig, options?: MercyOptions): number {
  return config.baseChance * (options?.multiplier ?? 1);
}

/**
 * Chance grows by `bonusPerShard` for every shard opened past `mercyThreshold`
 * (e.g. Void: still base chance at 200 opened, +5% at 201, +10% at 202, ...).
 */
export function calculateDropChance(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): number {
  const config = MERCY_CONFIGS[shardType];
  const shardsPastThreshold = Math.max(0, sinceLastDrop - config.mercyThreshold);
  const chance = effectiveBaseChance(config, options) + shardsPastThreshold * config.bonusPerShard;
  return round(Math.min(chance, config.maxChance));
}

/** Shard count (since last drop) at which the chance first reaches maxChance. */
export function getGuaranteedAt(shardType: ShardType, options?: MercyOptions): number {
  const config = MERCY_CONFIGS[shardType];
  const shardsNeeded = Math.ceil((config.maxChance - effectiveBaseChance(config, options)) / config.bonusPerShard);
  return config.mercyThreshold + shardsNeeded;
}

export interface MercyProgress {
  sinceLastDrop: number;
  mercyThreshold: number;
  guaranteedAt: number;
  mercyActive: boolean;
  /** 0-1 progress toward reaching mercyThreshold (caps at 1 once reached). */
  preMercyProgress: number;
  /** 0-1 progress from mercyThreshold toward guaranteedAt (0 until mercy is active). */
  mercyProgress: number;
}

export function getMercyProgress(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): MercyProgress {
  const config = MERCY_CONFIGS[shardType];
  const guaranteedAt = getGuaranteedAt(shardType, options);
  const mercyActive = sinceLastDrop >= config.mercyThreshold;
  const mercyRange = guaranteedAt - config.mercyThreshold;

  return {
    sinceLastDrop,
    mercyThreshold: config.mercyThreshold,
    guaranteedAt,
    mercyActive,
    preMercyProgress: Math.min(1, sinceLastDrop / config.mercyThreshold),
    mercyProgress: mercyActive ? Math.min(1, (sinceLastDrop - config.mercyThreshold) / mercyRange) : 0,
  };
}
```

- [ ] **Step 4: Export `MercyOptions`**

Replace the full contents of `packages/mercy-calc/src/index.ts` with:

```ts
export type { ShardType, MercyConfig } from './types.js';
export { SHARD_TYPES } from './types.js';
export type { MercyProgress, MercyOptions } from './calculate.js';
export { MERCY_CONFIGS, calculateDropChance, getGuaranteedAt, getMercyProgress } from './calculate.js';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -w @rsl/mercy-calc`

Expected: PASS — all tests, including the pre-existing ones (unaffected, since
`options` defaults keep behavior identical when omitted) and the new
`multiplier option` block.

- [ ] **Step 6: Rebuild the compiled package**

Run: `npm run build -w @rsl/mercy-calc`

Expected: exits 0, no TypeScript errors — this refreshes `dist/`, which
`server-core` and `apps/web` import from (per `CLAUDE.md`'s workflow gotcha).

- [ ] **Step 7: Commit**

```bash
git add packages/mercy-calc/src/calculate.ts packages/mercy-calc/src/calculate.test.ts packages/mercy-calc/src/index.ts
git commit -m "Add multiplier option to mercy-calc for 2x events"
```

---

### Task 2: `mercy_events` migration and repository functions

**Files:**
- Create: `packages/server-core/src/migrations/002_mercy_events.sql`
- Modify: `packages/server-core/src/db.ts`
- Modify: `packages/server-core/src/repository.ts`

**Interfaces:**
- Consumes: `client` (libSQL client) from `./db.js`; `ShardType` from `@rsl/mercy-calc`.
- Produces: `MercyEventRow { id: number; groupId: string; shardType: ShardType; startDate: string; endDate: string; multiplier: number; label: string | null }`, `listMercyEvents(): Promise<MercyEventRow[]>`, `getActiveMercyEvents(shardTypes: ShardType[]): Promise<Map<ShardType, MercyEventRow>>`, `createMercyEvent(shardTypes: ShardType[], startDate: string, endDate: string, label: string | null): Promise<string>` (returns the new `groupId`), `deleteMercyEventGroup(groupId: string): Promise<void>` — all consumed by Task 4 (routes) and Task 5 (`/api/shards`).

- [ ] **Step 1: Add the migration file**

Create `packages/server-core/src/migrations/002_mercy_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS mercy_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  shard_type TEXT NOT NULL CHECK (shard_type IN ('ANCIENT', 'VOID', 'PRIMAL', 'SACRED')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  multiplier REAL NOT NULL DEFAULT 2.0,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mercy_events_group ON mercy_events (group_id);
CREATE INDEX IF NOT EXISTS idx_mercy_events_dates ON mercy_events (shard_type, start_date, end_date);
```

- [ ] **Step 2: Run the new migration on every startup**

In `packages/server-core/src/db.ts`, replace:

```ts
const migrationSql = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf-8');

// Idempotent (CREATE TABLE/INDEX IF NOT EXISTS) — safe to run on every cold start.
await client.executeMultiple(migrationSql);
```

with:

```ts
const MIGRATION_FILES = ['001_init.sql', '002_mercy_events.sql'];

// Idempotent (CREATE TABLE/INDEX IF NOT EXISTS) — safe to run on every cold start.
for (const file of MIGRATION_FILES) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', file), 'utf-8');
  await client.executeMultiple(migrationSql);
}
```

- [ ] **Step 3: Add the repository functions**

In `packages/server-core/src/repository.ts`, add `randomUUID` to the top-level
imports (change the first line from `import { SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';` to include the new import), then append the new section at the
end of the file:

```ts
import { randomUUID } from 'node:crypto';
import { SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import { client } from './db.js';
```

Append to the end of `packages/server-core/src/repository.ts`:

```ts
export interface MercyEventRow {
  id: number;
  groupId: string;
  shardType: ShardType;
  startDate: string;
  endDate: string;
  multiplier: number;
  label: string | null;
}

interface RawMercyEventRow {
  id: number;
  group_id: string;
  shard_type: ShardType;
  start_date: string;
  end_date: string;
  multiplier: number;
  label: string | null;
}

function toMercyEventRow(row: RawMercyEventRow): MercyEventRow {
  return {
    id: Number(row.id),
    groupId: row.group_id,
    shardType: row.shard_type,
    startDate: row.start_date,
    endDate: row.end_date,
    multiplier: Number(row.multiplier),
    label: row.label,
  };
}

const MERCY_EVENT_COLUMNS = 'id, group_id, shard_type, start_date, end_date, multiplier, label';

export async function listMercyEvents(): Promise<MercyEventRow[]> {
  const rs = await client.execute(
    `SELECT ${MERCY_EVENT_COLUMNS} FROM mercy_events ORDER BY start_date DESC, id DESC`,
  );
  return (rs.rows as unknown as RawMercyEventRow[]).map(toMercyEventRow);
}

/**
 * Returns the currently-active event (if any) per shard type. If two events for the
 * same shard type overlap today (not expected in normal admin use), the
 * most-recently-created one wins.
 */
export async function getActiveMercyEvents(shardTypes: ShardType[]): Promise<Map<ShardType, MercyEventRow>> {
  const placeholders = shardTypes.map(() => '?').join(', ');
  const rs = await client.execute({
    sql: `SELECT ${MERCY_EVENT_COLUMNS} FROM mercy_events
          WHERE shard_type IN (${placeholders}) AND start_date <= date('now') AND end_date >= date('now')
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
  startDate: string,
  endDate: string,
  label: string | null,
): Promise<string> {
  const groupId = randomUUID();
  const tx = await client.transaction('write');
  try {
    for (const shardType of shardTypes) {
      await tx.execute({
        sql: `INSERT INTO mercy_events (group_id, shard_type, start_date, end_date, multiplier, label)
              VALUES (?, ?, ?, ?, 2.0, ?)`,
        args: [groupId, shardType, startDate, endDate, label],
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
```

- [ ] **Step 4: Rebuild and verify no type errors**

Run: `npm run build -w @rsl/server-core`

Expected: exits 0. (`SHARD_TYPES` is unused directly by the new functions, but it's
already imported/used elsewhere in the file — no unused-import error.)

- [ ] **Step 5: Commit**

```bash
git add packages/server-core/src/migrations/002_mercy_events.sql packages/server-core/src/db.ts packages/server-core/src/repository.ts
git commit -m "Add mercy_events table and repository functions"
```

---

### Task 3: Admin identification

**Files:**
- Create: `packages/server-core/src/admin.ts`
- Modify: `packages/server-core/src/routes/auth.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: `isAdminUsername(username: string | undefined | null): boolean`, consumed by Task 4's route guard and by `auth.ts`'s three response bodies. `/api/auth/register`, `/api/auth/login`, `/api/auth/me` now all return `{ username: string; isAdmin: boolean }` instead of `{ username: string }` — the frontend's `AuthUser` type (Task 6) must match this shape.

- [ ] **Step 1: Add the admin helper**

Create `packages/server-core/src/admin.ts`:

```ts
export function isAdminUsername(username: string | undefined | null): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  return !!adminUsername && username === adminUsername;
}
```

- [ ] **Step 2: Include `isAdmin` in the auth responses**

In `packages/server-core/src/routes/auth.ts`, add the import at the top (after the
existing `repository.js` import):

```ts
import { isAdminUsername } from '../admin.js';
```

Then change all three `return { username: profile.username };` occurrences (in
`/api/auth/register`, `/api/auth/login`, and `/api/auth/me`) to:

```ts
return { username: profile.username, isAdmin: isAdminUsername(profile.username) };
```

- [ ] **Step 3: Document the new env var**

In `CLAUDE.md`, under the `## Deployment` section, change:

```markdown
- **Env vars** (Vercel → Settings → Environment Variables, Production + Preview): `DATABASE_URL` (`libsql://...` from `turso db show <name> --url`), `DATABASE_AUTH_TOKEN` (from `turso db tokens create <name>`).
```

to:

```markdown
- **Env vars** (Vercel → Settings → Environment Variables, Production + Preview): `DATABASE_URL` (`libsql://...` from `turso db show <name> --url`), `DATABASE_AUTH_TOKEN` (from `turso db tokens create <name>`), `ADMIN_USERNAME` (the one profile username allowed to schedule 2x events — compared as a plain string, no DB column involved).
```

- [ ] **Step 4: Rebuild and verify no type errors**

Run: `npm run build -w @rsl/server-core`

Expected: exits 0.

- [ ] **Step 5: Manual verification**

Run: `ADMIN_USERNAME=testadmin npm run dev:server` (in one terminal), then in
another terminal:

```bash
curl -s -c /tmp/rsl-cookies -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' -d '{"username":"testadmin","password":"testpass"}'
```

Expected: JSON response includes `"isAdmin":true`. Then register a second user with
a different username and confirm `"isAdmin":false`. Stop the dev server
(`Ctrl+C`) when done.

- [ ] **Step 6: Commit**

```bash
git add packages/server-core/src/admin.ts packages/server-core/src/routes/auth.ts CLAUDE.md
git commit -m "Add admin identification via ADMIN_USERNAME env var"
```

---

### Task 4: Admin-only events API routes

**Files:**
- Create: `packages/server-core/src/routes/events.ts`
- Modify: `packages/server-core/src/app.ts`

**Interfaces:**
- Consumes: `isAdminUsername` from `../admin.js`; `getProfileById`, `listMercyEvents`, `createMercyEvent`, `deleteMercyEventGroup` from `../repository.js` (Task 2); `ShardType` from `@rsl/mercy-calc`.
- Produces: `eventRoutes(app: FastifyInstance)` registered in `app.ts`. Routes: `GET /api/events` → `MercyEventRow[]`; `POST /api/events` body `{ shardTypes: ShardType[]; startDate: string; endDate: string; label?: string }` → `{ groupId: string }`; `DELETE /api/events/:groupId` → `{ ok: true }`. All three require the caller's session to belong to the admin profile (403 otherwise, 401 if not logged in).

- [ ] **Step 1: Write the route file**

Create `packages/server-core/src/routes/events.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { type ShardType } from '@rsl/mercy-calc';
import { isAdminUsername } from '../admin.js';
import { createMercyEvent, deleteMercyEventGroup, getProfileById, listMercyEvents } from '../repository.js';

const SUPPORTED_EVENT_SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'PRIMAL', 'SACRED'];

function isSupportedEventShardType(value: unknown): value is ShardType {
  return typeof value === 'string' && (SUPPORTED_EVENT_SHARD_TYPES as string[]).includes(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
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

  app.post<{ Body: { shardTypes?: unknown[]; startDate?: string; endDate?: string; label?: string } }>(
    '/api/events',
    async (request, reply) => {
      const { shardTypes, startDate, endDate, label } = request.body ?? {};

      if (!Array.isArray(shardTypes) || shardTypes.length === 0) {
        return reply.code(400).send({ error: 'Vyber alespoň jeden shard' });
      }
      for (const shardType of shardTypes) {
        if (!isSupportedEventShardType(shardType)) {
          return reply.code(400).send({ error: 'Neplatný typ shardu pro 2x event' });
        }
      }
      if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
        return reply.code(400).send({ error: 'Datum od musí předcházet datu do (formát YYYY-MM-DD)' });
      }

      const groupId = await createMercyEvent(shardTypes as ShardType[], startDate, endDate, label?.trim() || null);
      return { groupId };
    },
  );

  app.delete<{ Params: { groupId: string } }>('/api/events/:groupId', async (request) => {
    await deleteMercyEventGroup(request.params.groupId);
    return { ok: true };
  });
}
```

- [ ] **Step 2: Register the routes**

In `packages/server-core/src/app.ts`, add the import:

```ts
import { eventRoutes } from './routes/events.js';
```

and register it alongside the existing routes:

```ts
await app.register(authRoutes);
await app.register(shardRoutes);
await app.register(eventRoutes);
```

- [ ] **Step 3: Rebuild**

Run: `npm run build -w @rsl/server-core`

Expected: exits 0.

- [ ] **Step 4: Manual verification**

Run: `ADMIN_USERNAME=testadmin npm run dev:server`, then:

```bash
# log in as the admin user created in Task 3's verification
curl -s -c /tmp/rsl-cookies -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"testadmin","password":"testpass"}'

# create an event as admin — expect { "groupId": "..." }
curl -s -b /tmp/rsl-cookies -X POST http://localhost:3001/api/events \
  -H 'Content-Type: application/json' \
  -d '{"shardTypes":["ANCIENT","SACRED"],"startDate":"2026-07-01","endDate":"2026-12-31","label":"Test event"}'

# list events — expect 2 rows sharing the same group_id
curl -s -b /tmp/rsl-cookies http://localhost:3001/api/events

# as a non-admin user (register+login a second profile), same GET/POST must 403
```

Expected: admin gets `groupId` back and sees 2 rows on GET; a non-admin session gets
`{"error":"Nemáš oprávnění spravovat eventy"}` with a 403 status on every route.
Delete the test event via `curl -X DELETE http://localhost:3001/api/events/<groupId>`
and confirm GET returns an empty array again. Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add packages/server-core/src/routes/events.ts packages/server-core/src/app.ts
git commit -m "Add admin-only events CRUD routes"
```

---

### Task 5: Extend `/api/shards` with `activeEvent`

**Files:**
- Modify: `packages/server-core/src/routes/shards.ts`

**Interfaces:**
- Consumes: `getActiveMercyEvents`, `MercyEventRow` from `../repository.js` (Task 2); `calculateDropChance` with `MercyOptions` from `@rsl/mercy-calc` (Task 1).
- Produces: every shard object returned by `GET /api/shards`, `POST /api/shards/:shardType/add`, and `PUT /api/shards/:shardType/since-last-drop` now includes `activeEvent: { multiplier: number; endDate: string; label: string | null } | null` alongside the existing fields — this is what `apps/web`'s `ShardCounterState` type (Task 6) must match.

- [ ] **Step 1: Update `withChance` and the three route handlers**

Replace the full contents of `packages/server-core/src/routes/shards.ts` with:

```ts
import type { FastifyInstance } from 'fastify';
import { calculateDropChance, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import {
  addShards,
  correctSinceLastDrop,
  getActiveMercyEvents,
  getAllCounters,
  type MercyEventRow,
  type ShardCounterRow,
} from '../repository.js';

function isShardType(value: string): value is ShardType {
  return (SHARD_TYPES as string[]).includes(value);
}

function withChance(row: ShardCounterRow, activeEvents: Map<ShardType, MercyEventRow>) {
  const activeEvent = activeEvents.get(row.shardType);
  return {
    ...row,
    currentChance: calculateDropChance(row.shardType, row.sinceLastDrop, { multiplier: activeEvent?.multiplier ?? 1 }),
    activeEvent: activeEvent
      ? { multiplier: activeEvent.multiplier, endDate: activeEvent.endDate, label: activeEvent.label }
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

  app.put<{ Params: { shardType: string }; Body: { value?: number; gotDrop?: boolean } }>(
    '/api/shards/:shardType/since-last-drop',
    async (request, reply) => {
      const { shardType } = request.params;
      const { value, gotDrop = false } = request.body ?? {};

      if (!isShardType(shardType)) {
        return reply.code(400).send({ error: 'Invalid shardType' });
      }
      if (!Number.isInteger(value) || (value as number) < 0) {
        return reply.code(400).send({ error: 'value must be an integer >= 0' });
      }

      const updated = await correctSinceLastDrop(request.profileId!, shardType, value as number, gotDrop);
      const activeEvents = await getActiveMercyEvents([shardType]);
      return withChance(updated, activeEvents);
    },
  );
}
```

- [ ] **Step 2: Rebuild**

Run: `npm run build -w @rsl/server-core`

Expected: exits 0.

- [ ] **Step 3: Manual verification**

With `ADMIN_USERNAME=testadmin npm run dev:server` running and logged in as admin
(cookies from Task 4), create an event covering today for `ANCIENT`:

```bash
curl -s -b /tmp/rsl-cookies -X POST http://localhost:3001/api/events \
  -H 'Content-Type: application/json' \
  -d '{"shardTypes":["ANCIENT"],"startDate":"2026-07-01","endDate":"2026-12-31"}'

curl -s -b /tmp/rsl-cookies http://localhost:3001/api/shards
```

Expected: the `ANCIENT` entry has `"currentChance":0.01` (double the normal `0.005`
at 0 opened) and a non-null `activeEvent` with `"multiplier":2`; the other 4 shard
types have `"activeEvent":null` and their normal `currentChance`. Delete the event
afterward (`curl -X DELETE .../api/events/<groupId>`) to leave the DB clean, and
stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add packages/server-core/src/routes/shards.ts
git commit -m "Apply active mercy event multiplier to /api/shards responses"
```

---

### Task 6: Frontend data layer (types, auth client, events client)

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api/authClient.ts`
- Create: `apps/web/src/api/eventsClient.ts`

**Interfaces:**
- Produces: `ActiveMercyEvent { multiplier: number; endDate: string; label: string | null }`, extended `ShardCounterState` (adds `activeEvent: ActiveMercyEvent | null`), extended `AuthUser` (adds `isAdmin: boolean`), `MercyEvent { id: number; groupId: string; shardType: ShardType; startDate: string; endDate: string; multiplier: number; label: string | null }`, `fetchEvents(): Promise<MercyEvent[]>`, `createEvent(shardTypes: ShardType[], startDate: string, endDate: string, label: string): Promise<{ groupId: string }>`, `deleteEventGroup(groupId: string): Promise<void>` — all consumed by Task 7 (`EventsAdminModal`) and Task 8 (`ShardCard`).

- [ ] **Step 1: Extend `ShardCounterState`**

In `apps/web/src/types.ts`, replace:

```ts
export interface ShardCounterState {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
}
```

with:

```ts
export interface ActiveMercyEvent {
  multiplier: number;
  endDate: string;
  label: string | null;
}

export interface ShardCounterState {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
  activeEvent: ActiveMercyEvent | null;
}
```

- [ ] **Step 2: Extend `AuthUser`**

In `apps/web/src/api/authClient.ts`, replace:

```ts
export interface AuthUser {
  username: string;
}
```

with:

```ts
export interface AuthUser {
  username: string;
  isAdmin: boolean;
}
```

- [ ] **Step 3: Add the events API client**

Create `apps/web/src/api/eventsClient.ts`:

```ts
import type { ShardType } from '@rsl/mercy-calc';

export interface MercyEvent {
  id: number;
  groupId: string;
  shardType: ShardType;
  startDate: string;
  endDate: string;
  multiplier: number;
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
  startDate: string,
  endDate: string,
  label: string,
): Promise<{ groupId: string }> {
  return fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ shardTypes, startDate, endDate, label: label.trim() || undefined }),
  }).then((res) => handleEventsResponse<{ groupId: string }>(res));
}

export function deleteEventGroup(groupId: string): Promise<void> {
  return fetch(`/api/events/${groupId}`, { method: 'DELETE', credentials: 'include' }).then((res) => {
    if (!res.ok) throw new Error('Smazání se nezdařilo');
  });
}
```

- [ ] **Step 4: Verify the frontend still type-checks**

Run: `cd apps/web && npx tsc --noEmit`

Expected: exits 0. (`ShardCard.tsx` doesn't read `activeEvent` yet — added in Task
8 — so this only confirms the type additions themselves compile cleanly.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/api/authClient.ts apps/web/src/api/eventsClient.ts
git commit -m "Add frontend types and API client for mercy events"
```

---

### Task 7: `EventsAdminModal` and Dashboard admin entry point

**Files:**
- Create: `apps/web/src/components/EventsAdminModal.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `fetchEvents`, `createEvent`, `deleteEventGroup`, `MercyEvent` from `../api/eventsClient` (Task 6); `SHARD_META` from `../types`; `useAuth` from `../auth/AuthContext` (now exposing `user.isAdmin`, Task 6).
- Produces: `EventsAdminModal({ onClose: () => void })`, rendered only for `user?.isAdmin` from `Dashboard`.

- [ ] **Step 1: Write `EventsAdminModal`**

Create `apps/web/src/components/EventsAdminModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { SHARD_META } from '../types';
import { createEvent, deleteEventGroup, fetchEvents, type MercyEvent } from '../api/eventsClient';

interface EventsAdminModalProps {
  onClose: () => void;
}

const LEGENDARY_SHARDS: ShardType[] = ['ANCIENT', 'VOID', 'SACRED'];
const MYTHICAL_SHARDS: ShardType[] = ['PRIMAL'];
const EVENT_SHARD_TYPES: ShardType[] = [...LEGENDARY_SHARDS, ...MYTHICAL_SHARDS];

interface EventGroup {
  groupId: string;
  shardTypes: ShardType[];
  startDate: string;
  endDate: string;
  label: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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
    startDate: rows[0].startDate,
    endDate: rows[0].endDate,
    label: rows[0].label,
  }));
}

function isActiveToday(startDate: string, endDate: string): boolean {
  const today = todayIso();
  return startDate <= today && endDate >= today;
}

export function EventsAdminModal({ onClose }: EventsAdminModalProps) {
  const [events, setEvents] = useState<MercyEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<ShardType>>(new Set());
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    fetchEvents()
      .then(setEvents)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleShard = (shardType: ShardType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shardType)) next.delete(shardType);
      else next.add(shardType);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0 || startDate > endDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEvent(Array.from(selected), startDate, endDate, label);
      setSelected(new Set());
      setLabel('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření se nezdařilo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    setError(null);
    try {
      await deleteEventGroup(groupId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smazání se nezdařilo');
    }
  };

  const groups = events ? groupEvents(events) : [];

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm font-semibold">Naplánovat 2x event</p>

        <form onSubmit={handleCreate} className="mb-5 border-b border-slate-800 pb-5">
          <p className="mb-1.5 text-xs text-slate-400">Shardy</p>
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
          <div className="mb-3 flex flex-wrap gap-3">
            {EVENT_SHARD_TYPES.map((shardType) => (
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

          <div className="mb-3 flex gap-2">
            <label className="flex-1 text-xs text-slate-400">
              Od
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="flex-1 text-xs text-slate-400">
              Do
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 focus:border-slate-500 focus:outline-none"
              />
            </label>
          </div>

          <input
            type="text"
            placeholder="Název (volitelné)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mb-3 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          />

          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={selected.size === 0 || startDate > endDate || submitting}
            className="h-9 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Ukládám…' : 'Naplánovat event'}
          </button>
        </form>

        <p className="mb-2 text-xs text-slate-400">Naplánované eventy</p>
        {!events && <p className="text-xs text-slate-500">Načítání…</p>}
        {events && groups.length === 0 && <p className="text-xs text-slate-500">Zatím žádné eventy.</p>}
        <ul className="space-y-2">
          {groups.map((group) => (
            <li
              key={group.groupId}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                isActiveToday(group.startDate, group.endDate)
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                  : 'border-slate-800 bg-slate-800/50 text-slate-400'
              }`}
            >
              <div>
                <p className="font-medium">
                  {group.shardTypes.map((s) => SHARD_META[s].label).join(', ')}
                  {group.label ? ` — ${group.label}` : ''}
                </p>
                <p>
                  {group.startDate} → {group.endDate}
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
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-slate-100 hover:bg-slate-700"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the admin icon into `Dashboard`**

Replace the full contents of `apps/web/src/components/Dashboard.tsx` with:

```tsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useShardData } from '../hooks/useShardData';
import { ShardCard } from './ShardCard';
import { UserMenu } from './UserMenu';
import { InstallBanner } from './InstallBanner';
import { EventsAdminModal } from './EventsAdminModal';

function LightningIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Dashboard() {
  const { shards, error, logShards, correctCount, confirmDrop } = useShardData();
  const { user } = useAuth();
  const [showEventsAdmin, setShowEventsAdmin] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 pb-12 sm:px-6 sm:py-8 sm:pb-16">
      <header className="mb-4 flex items-center justify-between gap-4 sm:mb-6 sm:items-start">
        <div>
          <h1 className="m-0 text-lg font-semibold sm:text-2xl">Shard tracker</h1>
          <p className="mt-1 hidden text-sm text-slate-400 sm:block">
            Sleduj mercy progress a aktuální šanci na drop
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => setShowEventsAdmin(true)}
              title="Spravovat 2x eventy"
              aria-label="Spravovat 2x eventy"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
            >
              <LightningIcon />
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      <InstallBanner />

      {error && <p className="text-sm text-red-400">Nepodařilo se načíst data: {error}</p>}

      {!shards && !error && <p className="text-sm text-slate-400">Načítání…</p>}

      {shards && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {shards.map((shard) => (
            <ShardCard
              key={shard.shardType}
              data={shard}
              onLog={logShards}
              onCorrect={correctCount}
              onConfirmDrop={confirmDrop}
            />
          ))}
        </div>
      )}

      {showEventsAdmin && <EventsAdminModal onClose={() => setShowEventsAdmin(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Verify the frontend type-checks**

Run: `cd apps/web && npx tsc --noEmit`

Expected: exits 0.

- [ ] **Step 4: Manual verification**

Start the full dev stack (`ADMIN_USERNAME=testadmin npm run dev` from the repo
root), log in as `testadmin` in the browser, confirm the lightning icon appears
next to the user menu, open it, create an event for Ancient + Sacred covering
today, confirm it appears in the list with a gold border (active), delete it, and
confirm the list goes back to "Zatím žádné eventy." Then log in as a non-admin
user and confirm the icon is absent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EventsAdminModal.tsx apps/web/src/components/Dashboard.tsx
git commit -m "Add EventsAdminModal and wire it into the Dashboard for admins"
```

---

### Task 8: `ShardCard` visual treatment

**Files:**
- Create: `apps/web/src/utils/formatEventCountdown.ts`
- Modify: `apps/web/src/components/ShardCard.tsx`

**Interfaces:**
- Consumes: `data.activeEvent` (`ActiveMercyEvent | null`, from Task 6's `ShardCounterState`); `MERCY_CONFIGS` from `@rsl/mercy-calc` (for the un-boosted base chance); `getMercyProgress` now called with `{ multiplier }` (Task 1).
- Produces: `formatEventCountdown(endDate: string): string`, used only within `ShardCard`.

- [ ] **Step 1: Add the countdown formatter**

Create `apps/web/src/utils/formatEventCountdown.ts`:

```ts
function pluralizeDny(n: number): string {
  if (n === 1) return 'den';
  if (n >= 2 && n <= 4) return 'dny';
  return 'dní';
}

/** `endDate` is an ISO date (YYYY-MM-DD). Compares against the client's local today. */
export function formatEventCountdown(endDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);

  if (diffDays <= 0) return '2x event · končí dnes';
  return `2x event · končí za ${diffDays} ${pluralizeDny(diffDays)}`;
}
```

- [ ] **Step 2: Update `ShardCard`**

Replace the full contents of `apps/web/src/components/ShardCard.tsx` with:

```tsx
import { useState } from 'react';
import type { ShardType } from '@rsl/mercy-calc';
import { getMercyProgress, MERCY_CONFIGS } from '@rsl/mercy-calc';
import type { ShardCounterState } from '../types';
import { SHARD_META } from '../types';
import { MercyProgressBar } from './MercyProgressBar';
import { LifetimeStats } from './LifetimeStats';
import { LogShardsForm } from './LogShardsForm';
import { EditCountModal } from './EditCountModal';
import { DropCelebrationModal } from './DropCelebrationModal';
import { formatEventCountdown } from '../utils/formatEventCountdown';

interface ShardCardProps {
  data: ShardCounterState;
  onLog: (shardType: ShardType, amount: number, gotDrop: boolean) => Promise<void>;
  onCorrect: (shardType: ShardType, value: number, gotDrop: boolean) => Promise<void>;
  onConfirmDrop: (shardType: ShardType) => Promise<void>;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 2l2.2 6.8H21l-5.6 4.1 2.1 6.9L12 15.8 6.5 19.8l2.1-6.9L3 8.8h6.8Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShardCard({ data, onLog, onCorrect, onConfirmDrop }: ShardCardProps) {
  const [editing, setEditing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const meta = SHARD_META[data.shardType];
  const { mercyThreshold, guaranteedAt, mercyActive, preMercyProgress, mercyProgress } = getMercyProgress(
    data.shardType,
    data.sinceLastDrop,
    { multiplier: data.activeEvent?.multiplier ?? 1 },
  );

  const progressCaption = mercyActive
    ? `${data.sinceLastDrop - mercyThreshold} / ${guaranteedAt - mercyThreshold} do garance`
    : `${data.sinceLastDrop} / ${mercyThreshold} do mercy`;

  const baseChancePct = (MERCY_CONFIGS[data.shardType].baseChance * 100).toFixed(1);
  const currentChancePct = (data.currentChance * 100).toFixed(1);

  return (
    <div
      className={`rounded-xl border border-slate-800 border-l-[3px] bg-slate-900 p-4 ${meta.borderClass} ${
        data.activeEvent ? 'ring-1 ring-amber-400/40' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
          <span>{meta.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {data.activeEvent && (
            <span className="animate-pulse rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-900 shadow-[0_0_8px_1px_rgba(251,191,36,0.6)] motion-reduce:animate-none">
              ⚡ 2×
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${meta.pillClass}`}>
            {meta.dropLabel}
          </span>
        </div>
      </div>

      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="flex items-baseline gap-1.5">
          {data.activeEvent && (
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
        <LifetimeStats
          lifetimeOpened={data.lifetimeOpened}
          lifetimeDrops={data.lifetimeDrops}
          dropLabel={meta.dropLabel}
        />
      </div>

      <div className="mb-3">
        <MercyProgressBar
          mercyThreshold={mercyThreshold}
          guaranteedAt={guaranteedAt}
          preMercyProgress={preMercyProgress}
          mercyProgress={mercyProgress}
          fillClass={meta.fillClass}
          neonBgClass={meta.neonBgClass}
          neonGlowClass={meta.neonGlowClass}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-amber-400">{data.activeEvent ? formatEventCountdown(data.activeEvent.endDate) : ''}</span>
          <span className="text-slate-500">{progressCaption}</span>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <LogShardsForm shardType={data.shardType} maxAmount={guaranteedAt - data.sinceLastDrop} onSubmit={onLog} />
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Upravit počet"
          aria-label="Upravit počet"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={() => setCelebrating(true)}
          title={meta.celebrationButtonLabel}
          aria-label={meta.celebrationButtonLabel}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.celebrationButtonClass}`}
        >
          <DropIcon />
        </button>
      </div>

      {editing && (
        <EditCountModal
          shardType={data.shardType}
          currentValue={data.sinceLastDrop}
          dropFlagLabel={meta.dropFlagLabel}
          onClose={() => setEditing(false)}
          onSubmit={onCorrect}
        />
      )}

      {celebrating && (
        <DropCelebrationModal
          title={meta.celebrationTitle}
          onCancel={() => setCelebrating(false)}
          onConfirm={async () => {
            await onConfirmDrop(data.shardType);
            setCelebrating(false);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the frontend type-checks**

Run: `cd apps/web && npx tsc --noEmit`

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/utils/formatEventCountdown.ts apps/web/src/components/ShardCard.tsx
git commit -m "Add 2x event badge, before/after chance, countdown, and card ring to ShardCard"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the mercy-calc test suite one more time**

Run: `npm run test -w @rsl/mercy-calc`

Expected: PASS (all tests, including Task 1's new `multiplier option` block).

- [ ] **Step 2: Full rebuild**

Run: `npm install && npm run build -w @rsl/mercy-calc -w @rsl/server-core`

Expected: exits 0 (this also re-copies migration SQL into `dist/`, per
`server-core`'s build script).

- [ ] **Step 3: Full dev-stack walkthrough as admin**

Run `ADMIN_USERNAME=<your-test-username> npm run dev` from the repo root, then in
the browser:
1. Register/login as `<your-test-username>`.
2. Confirm the lightning icon appears next to the user menu; open it.
3. Schedule a 2x event for the "Legendary" quick-select (Ancient + Void + Sacred),
   dates covering today, label "Testovací event".
4. Close the modal and confirm all three affected `ShardCard`s show: the gold "⚡
   2×" badge next to their rarity pill, the struck-through base % → boosted %, the
   gold countdown line under the progress bar, and the gold ring around the card.
   Confirm `PRIMAL` and `REMNANT` cards show none of this.
5. Log a few shards on a boosted card (e.g. Ancient) and confirm the percentage
   and progress bar stay consistent with the boosted math (no jump when the event
   is later deleted mid-session vs. reloading).
6. Re-open the admin modal, delete the event, and confirm all four badges/rings
   disappear after the next `/api/shards` refresh (reload the page or log another
   shard to trigger a refetch).

- [ ] **Step 4: Confirm regular users are unaffected**

Log in as a second, non-admin profile and confirm: no lightning icon, no visual
event styling on any card (since no event is active), and that logging/correcting
shard counts still works normally.

- [ ] **Step 5: Confirm existing behavior is unchanged when no event is active**

With no event scheduled, spot-check 2-3 shard cards against the pre-existing
percentages (e.g. Sacred at a known `sinceLastDrop` value) to confirm the
multiplier default (`1`) hasn't altered any non-event math.
