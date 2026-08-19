# Card Redesign + Primal Dual Mercy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved shard-card redesign (icon-slot gem art, no rarity pill, event glow border, mercy caption that never loses the raw opened-count) and add a second, independent Legendary mercy track for Primal shards (base 1%, mercy after 75 shards, +1%/shard, guaranteed at 174), displayed as a secondary track on the same card.

**Architecture:** Refactor `mercy-calc`'s pure functions to operate on a `MercyConfig` directly (existing `ShardType`-based exports become thin wrappers, unchanged behavior) so a second config (`PRIMAL_LEGENDARY_MERCY_CONFIG`) can reuse the same math. Store Primal's second counter as three additive nullable-by-convention columns on the *same* `shard_counters` row (`since_last_legendary_drop`, `lifetime_legendary_opened`, `lifetime_legendary_drops`) rather than restructuring the table to one-row-per-rarity — every other shard type has exactly one rarity, so a generic multi-row model would be pure YAGNI. `shard_batches` gains a nullable `rarity` column, populated only for PRIMAL rows, so history/audit entries know which of the two tracks they affected.

**Tech Stack:** Fastify 5 + `@libsql/client` (backend), React 18 + TypeScript + Tailwind CSS v4 (frontend), vitest (only `mercy-calc` has tests — this plan adds to that suite).

**Spec:** This conversation's approved mockup (card shape, icon-slot gem art, no rarity pill, event glow, mercy caption format, Primal dual-track layout) — no separate design doc; the mockup screenshots and the user's Legendary formula (base 1%, mercy at 75, +1%/shard) are the spec.

## Global Constraints

- All user-facing text is Czech (see `CLAUDE.md` Localization section).
- Shard identity colors (blue/violet/crimson/amber) do not change — only chrome around them (surfaces, depth, typography, spacing, the removed rarity pill).
- No `LEGENDARY`/`MYTHICAL` text pill on shard cards or in the champion-name field labels anymore — the game itself already tells the player what a shard drops.
- Primal's Legendary track never affects the Mythical track's counters and vice versa — confirming one drop only resets that track's `since_last_drop`.
- Extra Legendary events remain restricted to Ancient/Void/Sacred (existing constraint, untouched) — `rarity` and `extraChampionName` are mutually exclusive in practice and this plan does not add cross-validation between them.
- The active 2x event multiplier (if any) applies uniformly to both of Primal's tracks — the event system stays per-shard-type, not per-rarity. This is a documented simplification, not an oversight.
- After editing `packages/mercy-calc/src` or `packages/server-core/src`, run `npm run build -w @rsl/mercy-calc -w @rsl/server-core` before the dev server picks up the change (see `CLAUDE.md` "Important workflow gotcha").
- `mercy-calc` is the only package with a test runner — TDD applies there; `server-core`/`web` changes are verified via `tsc` compiling cleanly and a manual browser walkthrough.
- Out of scope (call out to the user, do not silently attempt): `StatsTab.tsx`'s Luck Index still divides Primal's combined `lifetimeOpened`/`lifetimeDrops` by a single `baseChance` — now technically imprecise for Primal since two tracks share those columns. Decorative motion from the mockup (icon sparkle twinkle, scroll-triggered bar replay) is not ported — plain CSS transitions only.

---

## File Structure

**`packages/mercy-calc/src`:**
- `types.ts` (modify) — add `Rarity` type, reuse it in `MercyConfig.rarity`.
- `calculate.ts` (modify) — extract `*ForConfig` core functions; existing `ShardType`-based exports become wrappers; add `PRIMAL_LEGENDARY_MERCY_CONFIG`.
- `calculate.test.ts` (modify) — new tests for the `*ForConfig` functions and the Legendary config; existing tests untouched.
- `index.ts` (modify) — export the new symbols.

**`packages/server-core/src`:**
- `migrations/008_primal_legendary_mercy.sql` (new).
- `db.ts` (modify) — guard to run migration 008 on existing DBs.
- `repository.ts` (modify) — `ShardCounterRow.legendaryTrack`, dual-aware `addShards`/`correctSinceLastDrop`, `championPoolWhereClause` widened for PRIMAL, rarity-filtered `listChampionsForShardType`, new `isChampionOfRarity`, `DropRow.rarity`.
- `routes/shards.ts` (modify) — `withChance` computes `legendaryTrack.currentChance`; PUT route accepts/validates `rarity`.
- `routes/drops.ts` (modify) — rarity-aware `mercyActive`; `/api/champions/:shardType` accepts `?rarity=`.

**`apps/web/src`:**
- `types.ts` (modify) — `ShardCounterState.legendaryTrack`, `DropRecord.rarity`.
- `api/client.ts` (modify) — `correctSinceLastDrop(..., rarity?)`.
- `api/dropsClient.ts` (modify) — `fetchChampionSuggestions(shardType, rarity?)`.
- `hooks/useShardData.ts` (modify) — `correctCount`/`confirmDrop` thread `rarity`.
- `components/ShardIcons.tsx` (new) — 5 gem SVG components (one per shard type), ported from the mockup, colors baked in (no CSS variable needed — each icon is shard-specific).
- `components/MercyProgressBar.tsx` (modify) — restyle: thicker bar, threshold tick mark, gradient fills.
- `components/ShardCard.tsx` (modify) — icon slot instead of dot, no rarity pill, event glow border, new caption format, dual-track branch for Primal.
- `components/EditCountModal.tsx` (modify) — optional second field + rarity plumbing for Primal.
- `components/DropCelebrationModal.tsx` (modify) — rarity picker for Primal, rarity-filtered champion suggestions.
- `components/HistoryTab.tsx` (modify) — Primal rows show the drop's actual rarity, not always "mythical".
- `components/Dashboard.tsx` (modify) — responsive card sizing (dense on mobile, roomy on desktop) via Tailwind breakpoints.

---

### Task 1: mercy-calc — config-based core + Legendary track config

**Files:**
- Modify: `packages/mercy-calc/src/types.ts`
- Modify: `packages/mercy-calc/src/calculate.ts`
- Modify: `packages/mercy-calc/src/calculate.test.ts`
- Modify: `packages/mercy-calc/src/index.ts`

**Interfaces:**
- Produces: `Rarity`, `calculateDropChanceForConfig(config, sinceLastDrop, options?)`, `getGuaranteedAtForConfig(config, options?)`, `getMercyProgressForConfig(config, sinceLastDrop, options?)`, `PRIMAL_LEGENDARY_MERCY_CONFIG: MercyConfig` — every later backend/frontend task that touches Primal's second track uses these.
- Existing `calculateDropChance`, `getGuaranteedAt`, `getMercyProgress`, `MERCY_CONFIGS` keep their current signatures and behavior unchanged.

- [ ] **Step 1: Add the `Rarity` type**

In `packages/mercy-calc/src/types.ts`, add above `MercyConfig`:

```ts
export type Rarity = 'LEGENDARY' | 'MYTHICAL';
```

Change `MercyConfig.rarity: 'LEGENDARY' | 'MYTHICAL';` to `rarity: Rarity;`.

- [ ] **Step 2: Write the failing tests for the config-based core and the Legendary track**

Append to `packages/mercy-calc/src/calculate.test.ts`:

```ts
import {
  calculateDropChanceForConfig,
  getGuaranteedAtForConfig,
  getMercyProgressForConfig,
  PRIMAL_LEGENDARY_MERCY_CONFIG,
} from './calculate.js';

describe('PRIMAL_LEGENDARY_MERCY_CONFIG (secondary mercy track for Primal)', () => {
  it('stays at 1% base chance up to and including the 75-shard threshold', () => {
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 0)).toBeCloseTo(0.01);
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 74)).toBeCloseTo(0.01);
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 75)).toBeCloseTo(0.01);
  });

  it('adds 1% per shard past the threshold', () => {
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 76)).toBeCloseTo(0.02);
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 82)).toBeCloseTo(0.08);
  });

  it('is guaranteed at shard 174 and caps at 100%', () => {
    expect(getGuaranteedAtForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG)).toBe(174);
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 174)).toBe(1.0);
    expect(calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 100000)).toBe(1.0);
  });

  it('getMercyProgressForConfig tracks the secondary track independently of the primary one', () => {
    const progress = getMercyProgressForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, 82);
    expect(progress.mercyActive).toBe(true);
    expect(progress.mercyThreshold).toBe(75);
    expect(progress.guaranteedAt).toBe(174);
    expect(progress.mercyProgress).toBeCloseTo(7 / 99);
  });

  it('rarity is LEGENDARY, distinguishing it from Primal\'s own MYTHICAL config', () => {
    expect(PRIMAL_LEGENDARY_MERCY_CONFIG.rarity).toBe('LEGENDARY');
  });
});

describe('shardType-based wrappers still match pre-refactor behavior', () => {
  it('calculateDropChance/getGuaranteedAt/getMercyProgress are unchanged for every shard type', () => {
    expect(calculateDropChance('PRIMAL', 209)).toBeCloseTo(0.905);
    expect(getGuaranteedAt('SACRED')).toBe(59);
    expect(getMercyProgress('VOID', 209).mercyActive).toBe(true);
  });
});
```

- [ ] **Step 2b: Run the tests to verify the new ones fail (symbols don't exist yet)**

Run: `npm run test -w @rsl/mercy-calc`
Expected: FAIL — `calculateDropChanceForConfig` (and siblings, and `PRIMAL_LEGENDARY_MERCY_CONFIG`) are not exported from `./calculate.js`.

- [ ] **Step 3: Refactor `calculate.ts` to config-based core functions**

Replace the full contents of `packages/mercy-calc/src/calculate.ts` with:

```ts
import type { MercyConfig, ShardType } from './types.js';

export const MERCY_CONFIGS: Record<ShardType, MercyConfig> = {
  ANCIENT: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0, rarity: 'LEGENDARY' },
  VOID: { baseChance: 0.005, bonusPerShard: 0.05, mercyThreshold: 200, maxChance: 1.0, rarity: 'LEGENDARY' },
  PRIMAL: { baseChance: 0.005, bonusPerShard: 0.1, mercyThreshold: 200, maxChance: 1.0, rarity: 'MYTHICAL' },
  SACRED: { baseChance: 0.06, bonusPerShard: 0.02, mercyThreshold: 12, maxChance: 1.0, rarity: 'LEGENDARY' },
  REMNANT: { baseChance: 0.025, bonusPerShard: 0.01, mercyThreshold: 24, maxChance: 1.0, rarity: 'MYTHICAL' },
};

/** Primal's second, independent mercy track — a Legendary can drop from Primal shards
 * alongside the shard's main Mythical pity. Mercy starts after 75 shards without a
 * Legendary, then +1%/shard, guaranteed at 174. Tracked separately from MERCY_CONFIGS.PRIMAL. */
export const PRIMAL_LEGENDARY_MERCY_CONFIG: MercyConfig = {
  baseChance: 0.01,
  bonusPerShard: 0.01,
  mercyThreshold: 75,
  maxChance: 1.0,
  rarity: 'LEGENDARY',
};

function round(value: number): number {
  // Avoid floating-point artifacts (e.g. 0.1 + 0.005 = 0.10500000000000001)
  return Math.round(value * 1e6) / 1e6;
}

export interface MercyOptions {
  /** Multiplies baseChance only (e.g. an active 2x event). Defaults to 1 (no change). */
  multiplier?: number;
}

function effectiveBaseChanceForConfig(config: MercyConfig, options?: MercyOptions): number {
  return config.baseChance * (options?.multiplier ?? 1);
}

/**
 * Chance grows by `config.bonusPerShard` for every shard opened past `config.mercyThreshold`.
 * This is the core formula; `calculateDropChance` below is a `ShardType`-keyed convenience
 * wrapper around it for the common single-track case.
 */
export function calculateDropChanceForConfig(config: MercyConfig, sinceLastDrop: number, options?: MercyOptions): number {
  const shardsPastThreshold = Math.max(0, sinceLastDrop - config.mercyThreshold);
  const chance = effectiveBaseChanceForConfig(config, options) + shardsPastThreshold * config.bonusPerShard;
  return round(Math.min(chance, config.maxChance));
}

/** Shard count (since last drop) at which the chance first reaches maxChance. */
export function getGuaranteedAtForConfig(config: MercyConfig, options?: MercyOptions): number {
  const shardsNeeded = Math.ceil((config.maxChance - effectiveBaseChanceForConfig(config, options)) / config.bonusPerShard);
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

export function getMercyProgressForConfig(config: MercyConfig, sinceLastDrop: number, options?: MercyOptions): MercyProgress {
  const guaranteedAt = getGuaranteedAtForConfig(config, options);
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

export function calculateDropChance(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): number {
  return calculateDropChanceForConfig(MERCY_CONFIGS[shardType], sinceLastDrop, options);
}

export function getGuaranteedAt(shardType: ShardType, options?: MercyOptions): number {
  return getGuaranteedAtForConfig(MERCY_CONFIGS[shardType], options);
}

export function getMercyProgress(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): MercyProgress {
  return getMercyProgressForConfig(MERCY_CONFIGS[shardType], sinceLastDrop, options);
}
```

- [ ] **Step 4: Export the new symbols from `index.ts`**

In `packages/mercy-calc/src/index.ts`, change:

```ts
export type { ShardType, MercyConfig } from './types.js';
```

to:

```ts
export type { ShardType, MercyConfig, Rarity } from './types.js';
```

and change:

```ts
export { MERCY_CONFIGS, calculateDropChance, getGuaranteedAt, getMercyProgress } from './calculate.js';
```

to:

```ts
export {
  MERCY_CONFIGS,
  PRIMAL_LEGENDARY_MERCY_CONFIG,
  calculateDropChance,
  getGuaranteedAt,
  getMercyProgress,
  calculateDropChanceForConfig,
  getGuaranteedAtForConfig,
  getMercyProgressForConfig,
} from './calculate.js';
```

- [ ] **Step 5: Run the full mercy-calc suite and confirm everything passes**

Run: `npm run test -w @rsl/mercy-calc`
Expected: PASS — all pre-existing tests (12) plus the new ones, 0 failures.

- [ ] **Step 6: Build the package so downstream packages pick up the change**

Run: `npm run build -w @rsl/mercy-calc`

- [ ] **Step 7: Commit**

```bash
git add packages/mercy-calc
git commit -m "mercy-calc: config-based core + Primal Legendary mercy track"
```

---

### Task 2: Database migration for Primal's Legendary track

**Files:**
- Create: `packages/server-core/src/migrations/008_primal_legendary_mercy.sql`
- Modify: `packages/server-core/src/db.ts`

**Interfaces:**
- Produces: `shard_counters.since_last_legendary_drop`, `shard_counters.lifetime_legendary_opened`, `shard_counters.lifetime_legendary_drops` (all `INTEGER NOT NULL DEFAULT 0`, meaningful only for PRIMAL rows), `shard_batches.rarity` (`TEXT CHECK (rarity IN ('LEGENDARY','MYTHICAL'))`, nullable, populated only for PRIMAL rows going forward — Task 4 reads/writes these).

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE shard_counters ADD COLUMN since_last_legendary_drop INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shard_counters ADD COLUMN lifetime_legendary_opened INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shard_counters ADD COLUMN lifetime_legendary_drops INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shard_batches ADD COLUMN rarity TEXT CHECK (rarity IN ('LEGENDARY', 'MYTHICAL'));
UPDATE shard_batches SET rarity = 'MYTHICAL' WHERE shard_type = 'PRIMAL';
```

Save as `packages/server-core/src/migrations/008_primal_legendary_mercy.sql`.

- [ ] **Step 2: Wire up guarded execution in `db.ts`**

Read `packages/server-core/src/db.ts` first. At the end of the file (after the existing `if (!shardBatchesColumnNames.has('extra_champion_id'))` block), add:

```ts
if (!shardBatchesColumnNames.has('rarity')) {
  const migrationSql = readFileSync(join(__dirname, 'migrations', '008_primal_legendary_mercy.sql'), 'utf-8');
  await client.executeMultiple(migrationSql);
}
```

This reuses the `shardBatchesColumnNames` snapshot already captured earlier in the file — one indicator column (`rarity`) guards both `ALTER TABLE` statements in the migration since they always run together.

- [ ] **Step 3: Delete the local dev DB and let it re-seed with the new schema**

Local dev DB is disposable per `CLAUDE.md`. Run:

```bash
rm -f apps/server/data/rsl.db apps/server/data/rsl.db-*
```

- [ ] **Step 4: Build server-core and verify the migration runs cleanly**

```bash
npm run build -w @rsl/server-core
```

Then start the dev server briefly (`npm run dev` from repo root, or just `node apps/server` after building — whichever the existing workflow uses) and confirm it boots without error, then stop it. Inspect the schema:

```bash
sqlite3 apps/server/data/rsl.db "PRAGMA table_info(shard_counters);" "PRAGMA table_info(shard_batches);"
```

Expected: `shard_counters` lists `since_last_legendary_drop`, `lifetime_legendary_opened`, `lifetime_legendary_drops`; `shard_batches` lists `rarity`.

- [ ] **Step 5: Commit**

```bash
git add packages/server-core/src/migrations/008_primal_legendary_mercy.sql packages/server-core/src/db.ts
git commit -m "server-core: add Primal Legendary mercy columns migration"
```

---

### Task 3: repository.ts — dual-track counters, rarity-aware corrections, widened champion pool

**Files:**
- Modify: `packages/server-core/src/repository.ts`

**Interfaces:**
- Consumes: migration 008's columns (Task 2).
- Produces: `ShardCounterRow.legendaryTrack: { sinceLastDrop, lifetimeOpened, lifetimeDrops } | null`; `addShards(profileId, shardType, amount, gotDrop)` unchanged signature, now dual-increments for PRIMAL; `correctSinceLastDrop(profileId, shardType, value, gotDrop, championName?, extraChampionName?, rarity?)` — new trailing optional `rarity` param; `listChampionsForShardType(shardType, rarity?)` — new optional param; `isChampionOfRarity(name, rarity)` — new; `DropRow.rarity: Rarity | null` — Task 5 (routes) and the frontend consume all of these.

- [ ] **Step 1: Read the current file**

Read `packages/server-core/src/repository.ts` in full before editing — this task touches most of its top half.

- [ ] **Step 2: Extend `ShardCounterRow` and the row mapper**

Replace:

```ts
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
```

with:

```ts
export interface LegendaryMercyRow {
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
}

export interface ShardCounterRow {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  /** Primal's independent Legendary pity track. Always null for every other shard type. */
  legendaryTrack: LegendaryMercyRow | null;
}

interface RawCounterRow {
  shard_type: ShardType;
  since_last_drop: number;
  lifetime_opened: number;
  lifetime_drops: number;
  since_last_legendary_drop: number;
  lifetime_legendary_opened: number;
  lifetime_legendary_drops: number;
}

function toShardCounterRow(row: RawCounterRow): ShardCounterRow {
  return {
    shardType: row.shard_type,
    sinceLastDrop: Number(row.since_last_drop),
    lifetimeOpened: Number(row.lifetime_opened),
    lifetimeDrops: Number(row.lifetime_drops),
    legendaryTrack:
      row.shard_type === 'PRIMAL'
        ? {
            sinceLastDrop: Number(row.since_last_legendary_drop),
            lifetimeOpened: Number(row.lifetime_legendary_opened),
            lifetimeDrops: Number(row.lifetime_legendary_drops),
          }
        : null,
  };
}

const SELECT_COUNTER_SQL = `SELECT shard_type, since_last_drop, lifetime_opened, lifetime_drops,
                             since_last_legendary_drop, lifetime_legendary_opened, lifetime_legendary_drops
                             FROM shard_counters WHERE profile_id = ? AND shard_type = ?`;
```

Also update the two inline SQL strings in `getAllCounters` (the one duplicated `SELECT shard_type, ...` literal) to select the same three new columns — search for the second occurrence of `since_last_drop, lifetime_opened, lifetime_drops` in `getAllCounters` and add the three legendary columns there too, matching `SELECT_COUNTER_SQL`.

- [ ] **Step 3: Make `addShards` dual-increment for PRIMAL**

Replace the body of `addShards` (the single `UPDATE shard_counters` call) with a branch:

```ts
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

    if (shardType === 'PRIMAL') {
      // Every shard opened counts toward both pity tracks. `gotDrop` here only ever
      // resets the Mythical track — the reachable UI path (LogShardsForm) never sets
      // gotDrop=true on this endpoint; a Legendary/Mythical drop is confirmed through
      // correctSinceLastDrop with an explicit `rarity` instead (see Task 5).
      const legendaryBefore = before.legendaryTrack!;
      const legendaryAfter = legendaryBefore.sinceLastDrop + amount;
      await tx.execute({
        sql: `UPDATE shard_counters
              SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?,
                  since_last_legendary_drop = ?, lifetime_legendary_opened = lifetime_legendary_opened + ?,
                  updated_at = datetime('now')
              WHERE profile_id = ? AND shard_type = ?`,
        args: [after, amount, gotDrop ? 1 : 0, legendaryAfter, amount, profileId, shardType],
      });
    } else {
      await tx.execute({
        sql: `UPDATE shard_counters
              SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
              WHERE profile_id = ? AND shard_type = ?`,
        args: [after, amount, gotDrop ? 1 : 0, profileId, shardType],
      });
    }

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
```

- [ ] **Step 4: Make `correctSinceLastDrop` rarity-aware**

Replace the whole function with:

```ts
export async function correctSinceLastDrop(
  profileId: number,
  shardType: ShardType,
  value: number,
  gotDrop: boolean,
  championName?: string | null,
  extraChampionName?: string | null,
  rarity?: 'LEGENDARY' | 'MYTHICAL' | null,
): Promise<ShardCounterRow> {
  const tx = await client.transaction('write');
  try {
    const beforeRs = await tx.execute({ sql: SELECT_COUNTER_SQL, args: [profileId, shardType] });
    const before = toShardCounterRow(beforeRs.rows[0] as unknown as RawCounterRow);
    const targetsLegendaryTrack = shardType === 'PRIMAL' && rarity === 'LEGENDARY';
    const after = gotDrop ? 0 : value;

    let seriesBefore: number;
    if (targetsLegendaryTrack) {
      const legendaryBefore = before.legendaryTrack!;
      seriesBefore = legendaryBefore.sinceLastDrop;
      const legendaryLifetimeDelta = value - legendaryBefore.sinceLastDrop;
      await tx.execute({
        sql: `UPDATE shard_counters
              SET since_last_legendary_drop = ?, lifetime_legendary_opened = lifetime_legendary_opened + ?,
                  lifetime_legendary_drops = lifetime_legendary_drops + ?, updated_at = datetime('now')
              WHERE profile_id = ? AND shard_type = ?`,
        args: [after, legendaryLifetimeDelta, gotDrop ? 1 : 0, profileId, shardType],
      });
    } else {
      seriesBefore = before.sinceLastDrop;
      const lifetimeDelta = value - before.sinceLastDrop;
      const dropCount = gotDrop ? (extraChampionName ? 2 : 1) : 0;
      await tx.execute({
        sql: `UPDATE shard_counters
              SET since_last_drop = ?, lifetime_opened = lifetime_opened + ?, lifetime_drops = lifetime_drops + ?, updated_at = datetime('now')
              WHERE profile_id = ? AND shard_type = ?`,
        args: [after, lifetimeDelta, dropCount, profileId, shardType],
      });
    }

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
              (profile_id, shard_type, action_type, amount, got_drop, since_last_drop_before, since_last_drop_after, champion_name, champion_id, extra_champion_name, extra_champion_id, rarity)
            VALUES (?, ?, 'CORRECTION', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        profileId,
        shardType,
        gotDrop ? 1 : 0,
        seriesBefore,
        after,
        championName ?? null,
        championId,
        extraChampionName ?? null,
        extraChampionId,
        shardType === 'PRIMAL' ? (rarity ?? 'MYTHICAL') : null,
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

Note the `INSERT` above has 11 `?` placeholders matching the 11 listed columns — count them against `args` when editing to avoid an off-by-one.

- [ ] **Step 5: Widen Primal's champion pool and add rarity-scoped lookups**

Replace `championPoolWhereClause`:

```ts
function championPoolWhereClause(shardType: ShardType): string {
  if (shardType === 'VOID') return `rarity = 'LEGENDARY' AND affinity = 'Void'`;
  if (shardType === 'ANCIENT' || shardType === 'SACRED') return `rarity = 'LEGENDARY' AND (affinity IS NULL OR affinity != 'Void')`;
  if (shardType === 'PRIMAL') return `rarity IN ('LEGENDARY', 'MYTHICAL')`;
  return `rarity = 'MYTHICAL'`; // REMNANT
}
```

Replace `listChampionsForShardType` and `isChampionInShardPool` with:

```ts
export async function listChampionsForShardType(shardType: ShardType, rarity?: 'LEGENDARY' | 'MYTHICAL'): Promise<string[]> {
  if (shardType === 'PRIMAL' && rarity) {
    const rs = await client.execute({ sql: `SELECT name FROM champions WHERE rarity = ? ORDER BY name`, args: [rarity] });
    return (rs.rows as unknown as { name: string }[]).map((row) => row.name);
  }
  const rs = await client.execute(`SELECT name FROM champions WHERE ${championPoolWhereClause(shardType)} ORDER BY name`);
  return (rs.rows as unknown as { name: string }[]).map((row) => row.name);
}

/** Used by the route layer to reject a championName that isn't a valid pick for this shard's pool. */
export async function isChampionInShardPool(shardType: ShardType, name: string): Promise<boolean> {
  const rs = await client.execute({
    sql: `SELECT 1 FROM champions WHERE ${championPoolWhereClause(shardType)} AND name = ? LIMIT 1`,
    args: [name],
  });
  return rs.rows.length > 0;
}

/** Stricter check for Primal: validates a championName against exactly the chosen
 * rarity's pool, so a Mythical name can't be confirmed under the Legendary track. */
export async function isChampionOfRarity(name: string, rarity: 'LEGENDARY' | 'MYTHICAL'): Promise<boolean> {
  const rs = await client.execute({ sql: `SELECT 1 FROM champions WHERE rarity = ? AND name = ? LIMIT 1`, args: [rarity, name] });
  return rs.rows.length > 0;
}
```

- [ ] **Step 6: Thread `rarity` through `DropRow`/`listDrops`**

Replace `DropRow`, `RawDropRow`, and `listDrops` with:

```ts
export interface DropRow {
  shardType: ShardType;
  createdAt: string;
  seriesNumber: number;
  championName: string | null;
  championUrl: string | null;
  extraChampionName: string | null;
  extraChampionUrl: string | null;
  eventKind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null;
  /** Which of Primal's two tracks this drop belongs to. Null for every other shard type. */
  rarity: 'LEGENDARY' | 'MYTHICAL' | null;
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
  rarity: 'LEGENDARY' | 'MYTHICAL' | null;
}

export async function listDrops(profileId: number): Promise<DropRow[]> {
  const rs = await client.execute({
    sql: `SELECT sb.shard_type, sb.created_at, sb.since_last_drop_before,
                 sb.champion_name, c.hellhades_url AS champion_url,
                 sb.extra_champion_name, ec.hellhades_url AS extra_champion_url,
                 sb.rarity,
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
    eventKind: row.event_kind,
    rarity: row.rarity,
  }));
}
```

- [ ] **Step 7: Build and typecheck**

```bash
npm run build -w @rsl/server-core
```

Expected: compiles with no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/server-core/src/repository.ts
git commit -m "server-core: dual-track Primal counters in repository layer"
```

---

### Task 4: routes/shards.ts and routes/drops.ts — expose the second track over HTTP

**Files:**
- Modify: `packages/server-core/src/routes/shards.ts`
- Modify: `packages/server-core/src/routes/drops.ts`

**Interfaces:**
- Consumes: `ShardCounterRow.legendaryTrack`, `correctSinceLastDrop(..., rarity?)`, `isChampionOfRarity`, `listChampionsForShardType(shardType, rarity?)`, `DropRow.rarity`, `PRIMAL_LEGENDARY_MERCY_CONFIG` (Tasks 1 & 3).
- Produces: `GET /api/shards` items gain `legendaryTrack: { sinceLastDrop, lifetimeOpened, lifetimeDrops, currentChance } | null`; `PUT /api/shards/:shardType/since-last-drop` accepts `rarity?: 'LEGENDARY' | 'MYTHICAL'` in the body; `GET /api/champions/:shardType` accepts `?rarity=` query param; `GET /api/drops` items' `mercyActive` is computed against the correct track's threshold.

- [ ] **Step 1: Update `withChance` in `routes/shards.ts`**

Replace the whole file's top (`isShardType` stays as-is) and `withChance` with:

```ts
import type { FastifyInstance } from 'fastify';
import { calculateDropChance, calculateDropChanceForConfig, PRIMAL_LEGENDARY_MERCY_CONFIG, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import {
  addShards,
  correctSinceLastDrop,
  getActiveMercyEvents,
  getAllCounters,
  isChampionInShardPool,
  isChampionOfRarity,
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
    legendaryTrack: row.legendaryTrack
      ? {
          ...row.legendaryTrack,
          currentChance: calculateDropChanceForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, row.legendaryTrack.sinceLastDrop, { multiplier }),
        }
      : null,
  };
}
```

- [ ] **Step 2: Accept and validate `rarity` in the PUT route**

Replace the PUT route handler body (keep the route registration signature but widen the `Body` type and add validation before the `correctSinceLastDrop` call):

```ts
  app.put<{
    Params: { shardType: string };
    Body: { value?: number; gotDrop?: boolean; championName?: string; extraChampionName?: string; rarity?: string };
  }>('/api/shards/:shardType/since-last-drop', async (request, reply) => {
    const { shardType } = request.params;
    const { value, gotDrop = false, championName, extraChampionName, rarity } = request.body ?? {};

    if (!isShardType(shardType)) {
      return reply.code(400).send({ error: 'Invalid shardType' });
    }
    if (!Number.isInteger(value) || (value as number) < 0) {
      return reply.code(400).send({ error: 'value must be an integer >= 0' });
    }

    let trimmedRarity: 'LEGENDARY' | 'MYTHICAL' | undefined;
    if (rarity === 'LEGENDARY' || rarity === 'MYTHICAL') {
      trimmedRarity = rarity;
    } else if (rarity) {
      return reply.code(400).send({ error: 'Invalid rarity' });
    }
    if (trimmedRarity === 'LEGENDARY' && shardType !== 'PRIMAL') {
      return reply.code(400).send({ error: 'rarity is only applicable to PRIMAL' });
    }

    const trimmedChampionName = championName?.trim().slice(0, 80) || null;
    if (trimmedChampionName) {
      const isValid =
        shardType === 'PRIMAL' && trimmedRarity
          ? await isChampionOfRarity(trimmedChampionName, trimmedRarity)
          : await isChampionInShardPool(shardType, trimmedChampionName);
      if (!isValid) {
        return reply.code(400).send({ error: 'Invalid championName for this shard type' });
      }
    }

    const activeEvents = await getActiveMercyEvents([shardType]);

    const trimmedExtraChampionName = extraChampionName?.trim().slice(0, 80) || null;
    if (trimmedExtraChampionName) {
      if (!gotDrop) {
        return reply.code(400).send({ error: 'extraChampionName requires gotDrop' });
      }
      if (activeEvents.get(shardType)?.kind !== 'EXTRA_LEGENDARY') {
        return reply.code(400).send({ error: 'No active Extra Legendary event for this shard type' });
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
      trimmedRarity,
    );
    return withChance(updated, activeEvents);
  });
```

- [ ] **Step 3: `/api/champions/:shardType` accepts `?rarity=`**

In `routes/drops.ts`, replace the champions route:

```ts
  app.get<{ Params: { shardType: string }; Querystring: { rarity?: string } }>(
    '/api/champions/:shardType',
    async (request, reply) => {
      const { shardType } = request.params;
      if (!isShardType(shardType)) {
        return reply.code(400).send({ error: 'Invalid shardType' });
      }
      const { rarity } = request.query;
      const trimmedRarity = rarity === 'LEGENDARY' || rarity === 'MYTHICAL' ? rarity : undefined;
      return listChampionsForShardType(shardType, trimmedRarity);
    },
  );
```

- [ ] **Step 4: Rarity-aware `mercyActive` in `GET /api/drops`**

In `routes/drops.ts`, update the import and the `/api/drops` handler:

```ts
import { MERCY_CONFIGS, PRIMAL_LEGENDARY_MERCY_CONFIG, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
```

```ts
  app.get('/api/drops', async (request) => {
    const drops = await listDrops(request.profileId!);
    return drops.map((drop) => {
      const config =
        drop.shardType === 'PRIMAL' && drop.rarity === 'LEGENDARY' ? PRIMAL_LEGENDARY_MERCY_CONFIG : MERCY_CONFIGS[drop.shardType];
      return { ...drop, mercyActive: drop.seriesNumber >= config.mercyThreshold };
    });
  });
```

- [ ] **Step 5: Build and typecheck**

```bash
npm run build -w @rsl/server-core
```

- [ ] **Step 6: Commit**

```bash
git add packages/server-core/src/routes/shards.ts packages/server-core/src/routes/drops.ts
git commit -m "server-core: expose Primal's Legendary track over the API"
```

---

### Task 5: Frontend types + API clients + hook

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/dropsClient.ts`
- Modify: `apps/web/src/hooks/useShardData.ts`

**Interfaces:**
- Consumes: the API shape from Task 4.
- Produces: `ShardCounterState.legendaryTrack`, `DropRecord.rarity`, `correctSinceLastDrop(shardType, value, gotDrop, championName?, extraChampionName?, rarity?)`, `fetchChampionSuggestions(shardType, rarity?)`, `useShardData().correctCount(shardType, value, gotDrop, rarity?)`, `useShardData().confirmDrop(shardType, championName, extraChampionName?, rarity?)` — Task 6/7/8 UI components consume these.

- [ ] **Step 1: Extend `types.ts`**

In `apps/web/src/types.ts`, add above `ShardCounterState`:

```ts
export interface LegendaryMercyState {
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
}
```

Add a field to `ShardCounterState`:

```ts
export interface ShardCounterState {
  shardType: ShardType;
  sinceLastDrop: number;
  lifetimeOpened: number;
  lifetimeDrops: number;
  currentChance: number;
  activeEvent: ActiveMercyEvent | null;
  /** Primal's independent Legendary pity track. Null for every other shard type. */
  legendaryTrack: LegendaryMercyState | null;
}
```

Add a field to `DropRecord`:

```ts
export interface DropRecord {
  shardType: ShardType;
  createdAt: string;
  seriesNumber: number;
  championName: string | null;
  championUrl: string | null;
  extraChampionName: string | null;
  extraChampionUrl: string | null;
  eventKind: 'MULTIPLIER' | 'EXTRA_LEGENDARY' | null;
  mercyActive: boolean;
  /** Which of Primal's two tracks this drop belongs to. Null for every other shard type. */
  rarity: 'LEGENDARY' | 'MYTHICAL' | null;
}
```

- [ ] **Step 2: Thread `rarity` through `api/client.ts`**

Replace `correctSinceLastDrop`:

```ts
export function correctSinceLastDrop(
  shardType: ShardType,
  value: number,
  gotDrop: boolean,
  championName?: string,
  extraChampionName?: string,
  rarity?: 'LEGENDARY' | 'MYTHICAL',
): Promise<ShardCounterState> {
  return fetch(`/api/shards/${shardType}/since-last-drop`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value, gotDrop, championName, extraChampionName, rarity }),
  }).then(handleResponse);
}
```

- [ ] **Step 3: Thread `rarity` through `api/dropsClient.ts`**

Replace `fetchChampionSuggestions`:

```ts
export function fetchChampionSuggestions(shardType: ShardType, rarity?: 'LEGENDARY' | 'MYTHICAL'): Promise<string[]> {
  const query = rarity ? `?rarity=${rarity}` : '';
  return fetch(`/api/champions/${shardType}${query}`, { credentials: 'include' }).then((res) =>
    handleDropsResponse<string[]>(res),
  );
}
```

- [ ] **Step 4: Thread `rarity` through `useShardData.ts`**

Replace `correctCount` and `confirmDrop`:

```ts
  const correctCount = useCallback(
    async (shardType: ShardType, value: number, gotDrop: boolean, rarity?: 'LEGENDARY' | 'MYTHICAL') => {
      const updated = await correctSinceLastDrop(shardType, value, gotDrop, undefined, undefined, rarity);
      setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
    },
    [],
  );

  const confirmDrop = useCallback(
    async (shardType: ShardType, championName: string, extraChampionName?: string, rarity?: 'LEGENDARY' | 'MYTHICAL') => {
      const current = shards?.find((s) => s.shardType === shardType);
      const targetsLegendary = shardType === 'PRIMAL' && rarity === 'LEGENDARY';
      const baseValue = targetsLegendary ? (current?.legendaryTrack?.sinceLastDrop ?? 0) : (current?.sinceLastDrop ?? 0);
      const updated = await correctSinceLastDrop(shardType, baseValue, true, championName, extraChampionName, rarity);
      setShards((prev) => prev?.map((s) => (s.shardType === shardType ? updated : s)) ?? prev);
    },
    [shards],
  );
```

Update the returned object if the property list is spelled out explicitly (it already includes `correctCount`/`confirmDrop` by reference, so no further change needed there).

- [ ] **Step 5: Typecheck the frontend**

```bash
npx tsc --noEmit -p apps/web
```

Expected: fails right now (ShardCard/EditCountModal/DropCelebrationModal callers don't match the new signatures yet) — that's expected until Tasks 6-8 land. Confirm the *only* errors are in those three files, not in `types.ts`/`client.ts`/`dropsClient.ts`/`useShardData.ts` themselves.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/api/client.ts apps/web/src/api/dropsClient.ts apps/web/src/hooks/useShardData.ts
git commit -m "web: thread Primal rarity through API clients and useShardData"
```

---

### Task 6: Shard gem icons

**Files:**
- Create: `apps/web/src/components/ShardIcons.tsx`

**Interfaces:**
- Produces: `ShardIcon({ shardType, className? }: { shardType: ShardType; className?: string })` — a single dispatcher component Task 7 (`ShardCard.tsx`) imports and renders inside the icon slot.

- [ ] **Step 1: Create the icon components**

Original artwork inspired by (not copied from) the mockup — faceted crystal silhouette per shard with a small gold accent facet, plus a distinct compact star shape for Remnant so it doesn't read identically to Primal despite sharing the same crimson color.

```tsx
import type { ShardType } from '@rsl/mercy-calc';

const GOLD = '#E3C583';
const GOLD_DARK = '#9a7a3a';

function FacetedShard({ c1, c2, c3, c4 }: { c1: string; c2: string; c3: string; c4: string }) {
  return (
    <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
      <polygon points="24,2 4,17 17,21 24,23" fill={c1} />
      <polygon points="24,2 24,23 31,21 44,17" fill={c2} />
      <polygon points="17,21 24,23 24,47" fill={c3} />
      <polygon points="24,23 31,21 24,47" fill={c4} />
    </g>
  );
}

function GoldAccent() {
  return (
    <>
      <polygon points="24,17 33,23 24,29 15,23" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="24,23 33,23 24,29" fill={GOLD_DARK} />
    </>
  );
}

function AncientIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <FacetedShard c1="#7DA8F8" c2="#2563EB" c3="#3B82F6" c4="#1D4ED8" />
      <GoldAccent />
    </svg>
  );
}

function VoidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="22,2 2,20 16,23 22,24" fill="#B29CF9" />
        <polygon points="22,2 22,24 29,22 41,11" fill="#7C4FE0" />
        <polygon points="16,23 22,24 25,47" fill="#8B5CF6" />
        <polygon points="22,24 29,22 25,47" fill="#5B21B6" />
      </g>
      <polygon points="23,18 32,23 23,30 14,24" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="23,24 32,23 23,30" fill={GOLD_DARK} />
    </svg>
  );
}

function SacredIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,4 8,17 18,21 24,23" fill="#FDE59A" />
        <polygon points="24,4 24,23 30,21 40,17" fill="#F0B429" />
        <polygon points="18,21 24,23 24,42" fill="#FBBF24" />
        <polygon points="24,23 30,21 24,42" fill="#B8860B" />
      </g>
      <g fill="#FDF3D6" opacity="0.95">
        <polygon points="6,3 8,7 6,11 4,7" />
        <polygon points="42,29 44,33 42,37 40,33" />
      </g>
      <polygon points="24,17 32,22 24,28 16,22" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="24,22 32,22 24,28" fill={GOLD_DARK} />
    </svg>
  );
}

function PrimalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,0 5,15 16,20 24,22" fill="#E05B5B" />
        <polygon points="24,0 24,22 32,20 43,15" fill="#C83232" />
        <polygon points="16,20 24,22 24,48" fill="#A30000" />
        <polygon points="24,22 32,20 24,48" fill="#6E0000" />
        <polygon points="5,15 -3,19 10,18" fill="#7A1010" />
      </g>
      <polygon points="24,16 33,21 24,27 15,21" fill={GOLD} stroke="rgba(0,0,0,.4)" strokeWidth="0.6" strokeLinejoin="round" />
      <polygon points="24,21 33,21 24,27" fill={GOLD_DARK} />
    </svg>
  );
}

function RemnantIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g stroke="rgba(0,0,0,.3)" strokeWidth="0.5" strokeLinejoin="round">
        <polygon points="24,3 30,15 24,24" fill="#E05B5B" />
        <polygon points="24,3 18,15 24,24" fill="#C24444" />
        <polygon points="45,24 33,20 24,24" fill="#C83232" />
        <polygon points="3,24 15,20 24,24" fill="#D06B6B" />
        <polygon points="24,45 30,33 24,24" fill="#A30000" />
        <polygon points="24,45 18,33 24,24" fill="#7A1818" />
        <polygon points="45,24 33,28 24,24" fill="#5C0F0F" />
        <polygon points="3,24 15,28 24,24" fill="#7A1F1F" />
      </g>
    </svg>
  );
}

const ICONS: Record<ShardType, (props: { className?: string }) => React.JSX.Element> = {
  ANCIENT: AncientIcon,
  VOID: VoidIcon,
  PRIMAL: PrimalIcon,
  SACRED: SacredIcon,
  REMNANT: RemnantIcon,
};

export function ShardIcon({ shardType, className }: { shardType: ShardType; className?: string }) {
  const Icon = ICONS[shardType];
  return <Icon className={className} />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p apps/web
```

Expected: no new errors from this file (pre-existing errors from Task 5's callers still present — fine for now).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ShardIcons.tsx
git commit -m "web: add original faceted-gem icon set per shard type"
```

---

### Task 7: MercyProgressBar restyle

**Files:**
- Modify: `apps/web/src/components/MercyProgressBar.tsx`

**Interfaces:**
- Consumes: same props as today (`mercyThreshold`, `guaranteedAt`, `preMercyProgress`, `mercyProgress`, `fillClass`, `neonBgClass`, `neonGlowClass`) — unchanged, so `ShardCard.tsx` (Task 8) doesn't need new plumbing here beyond what it already passes.
- Produces: same component, restyled — thicker bar (8px), rounded pill segments, tick mark at the threshold boundary.

- [ ] **Step 1: Read the current file**

Read `apps/web/src/components/MercyProgressBar.tsx` in full — it's short.

- [ ] **Step 2: Replace the JSX with the thicker, tick-marked version**

Keep the props interface and the `preWidthPct`/`mercyWidthPct` calculation exactly as-is. Replace the returned JSX:

```tsx
  return (
    <div className="flex h-2 gap-1 py-1">
      <div className="h-2 overflow-hidden rounded-l-full bg-slate-800" style={{ width: `${preWidthPct}%` }}>
        <div
          className={`h-full rounded-l-full transition-all ${fillClass}`}
          style={{ width: `${preMercyProgress * 100}%` }}
        />
      </div>
      <div className="h-2 rounded-r-full bg-slate-800" style={{ width: `${mercyWidthPct}%` }}>
        <div
          className={`h-full rounded-r-full transition-all ${neonBgClass} ${mercyProgress > 0 ? neonGlowClass : ''}`}
          style={{ width: `${mercyProgress * 100}%` }}
        />
      </div>
    </div>
  );
```

with:

```tsx
  return (
    <div className="relative flex h-2.5 gap-0.5 py-1">
      <div className="h-2.5 overflow-hidden rounded-l-full bg-slate-800/80" style={{ width: `${preWidthPct}%` }}>
        <div
          className={`h-full rounded-l-full transition-all duration-700 ease-out ${fillClass}`}
          style={{ width: `${preMercyProgress * 100}%` }}
        />
      </div>
      <div className="relative h-2.5 rounded-r-full bg-slate-800/80" style={{ width: `${mercyWidthPct}%` }}>
        <div
          className={`h-full rounded-r-full transition-all duration-700 ease-out ${neonBgClass} ${mercyProgress > 0 ? neonGlowClass : ''}`}
          style={{ width: `${mercyProgress * 100}%` }}
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-px bg-white/25"
        style={{ left: `${preWidthPct}%` }}
        aria-hidden="true"
      />
    </div>
  );
```

The tick mark is an absolutely-positioned 1px line at the threshold boundary (`preWidthPct`), sitting on top of both segments via the wrapping `relative` container.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p apps/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/MercyProgressBar.tsx
git commit -m "web: thicker mercy bar with threshold tick mark"
```

---

### Task 8: ShardCard.tsx redesign — icon slot, no pill, event glow, fixed caption, Primal dual track

**Files:**
- Modify: `apps/web/src/components/ShardCard.tsx`

**Interfaces:**
- Consumes: `ShardIcon` (Task 6), restyled `MercyProgressBar` (Task 7), `data.legendaryTrack` (Task 5), `onConfirmDrop(shardType, championName, extraChampionName?, rarity?)` — this task widens the prop type to match Task 5's `confirmDrop`.
- Produces: the new card markup Task 9 (Dashboard.tsx) and Task 10/11 (modals) plug into — no change to `ShardCard`'s own external props beyond widening `onConfirmDrop`'s signature and `onCorrect`'s signature to accept the trailing optional `rarity`.

**Design (from the approved mockup, translated to this codebase's Tailwind conventions):**
- Icon slot: a 44×44 rounded-xl dark tile (`bg-slate-950/60`) with `<ShardIcon>` inside, replacing the small colored dot.
- No `LEGENDARY`/`MYTHICAL` pill next to the shard name anymore.
- Event glow: when `isMultiplierEvent || isExtraLegendaryEvent`, the whole card gets a `border-2` in the shard's accent color plus a slow `animate-[pulse_2.4s_ease-in-out_infinite]` glow (reusing `meta.eventAccentClass`/`EXTRA_LEGENDARY_CARD_ACCENT_CLASS`, already shard-color-matched) instead of the current static border.
- Caption row: replace the single `progressCaption` line with two pieces that never lose the raw count — primary `${sinceLastDrop} otevřených`, secondary `ještě ${remaining} do mercy` / `ještě ${remaining} do garance` / `garantovaný drop` once remaining hits 0.
- Primal gets a second, smaller track (Legendary) rendered below a divider, using the same `MercyProgressBar` component fed `data.legendaryTrack` values and `PRIMAL_LEGENDARY_MERCY_CONFIG`.

- [ ] **Step 1: Read the current file in full**

Read `apps/web/src/components/ShardCard.tsx` — this task rewrites most of it, so work from the live version, not memory.

- [ ] **Step 2: Add the caption-formatting helper**

At the top of the file (after imports), add:

```tsx
function mercyCaption(sinceLastDrop: number, mercyThreshold: number, guaranteedAt: number, mercyActive: boolean) {
  const primary = `${sinceLastDrop} otevřených`;
  if (mercyActive) {
    const remaining = Math.max(guaranteedAt - sinceLastDrop, 0);
    const secondary = remaining === 0 ? 'garantovaný drop' : `ještě ${remaining} do garance`;
    return { primary, secondary };
  }
  const remaining = mercyThreshold - sinceLastDrop;
  return { primary, secondary: `ještě ${remaining} do mercy` };
}
```

- [ ] **Step 3: Replace the imports**

Add `ShardIcon` and the Primal legendary config/progress helper:

```tsx
import { getMercyProgress, getMercyProgressForConfig, MERCY_CONFIGS, PRIMAL_LEGENDARY_MERCY_CONFIG } from '@rsl/mercy-calc';
import { ShardIcon } from './ShardIcons';
```

(Add alongside the existing `import type { ShardType } from '@rsl/mercy-calc';` and other existing imports — don't duplicate the `ShardType` import, just extend the existing `@rsl/mercy-calc` import list.)

- [ ] **Step 4: Widen `ShardCardProps`**

```tsx
interface ShardCardProps {
  data: ShardCounterState;
  onLog: (shardType: ShardType, amount: number, gotDrop: boolean) => Promise<void>;
  onCorrect: (shardType: ShardType, value: number, gotDrop: boolean, rarity?: 'LEGENDARY' | 'MYTHICAL') => Promise<void>;
  onConfirmDrop: (
    shardType: ShardType,
    championName: string,
    extraChampionName?: string,
    rarity?: 'LEGENDARY' | 'MYTHICAL',
  ) => Promise<void>;
}
```

- [ ] **Step 5: Replace the header (dot + pill) with the icon slot, no pill**

Replace:

```tsx
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
          <span>{meta.label}</span>
        </div>
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
      </div>
```

with (note the `sm:` breakpoints — smaller icon slot and tighter gap below `sm`, so the header doesn't add much height on mobile; Task 9 does the same for the hero number and outer padding):

```tsx
      <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950/60 ring-1 ring-slate-800 sm:h-11 sm:w-11 sm:rounded-xl">
          <ShardIcon shardType={data.shardType} className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <span className="flex-1 text-[13px] font-semibold">{meta.label}</span>
        {isMultiplierEvent && (
          <span className="animate-[pulse_2.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-900 shadow-[0_0_8px_1px_rgba(251,191,36,0.6)] motion-reduce:animate-none">
            ⚡ 2×
          </span>
        )}
        {isExtraLegendaryEvent && <span className={EXTRA_LEGENDARY_BADGE_CLASS}>{EXTRA_LEGENDARY_BADGE_LABEL}</span>}
      </div>
```

- [ ] **Step 6: Replace the event border with the slow breathing glow**

Replace the outer `<div className={...border logic...}>` opening tag's className expression (the multi-line template literal near the top of the returned JSX):

```tsx
      className={`rounded-xl bg-slate-900 p-4 ${
        isExtraLegendaryEvent
          ? `border-2 ${EXTRA_LEGENDARY_CARD_ACCENT_CLASS}`
          : isMultiplierEvent
            ? `border-2 ${meta.eventAccentClass}`
            : `border border-slate-800 border-l-[3px] ${meta.borderClass}`
      }`}
```

with:

```tsx
      className={`rounded-xl bg-slate-900 p-4 ${
        isExtraLegendaryEvent
          ? `border-2 ${EXTRA_LEGENDARY_CARD_ACCENT_CLASS} animate-[pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none`
          : isMultiplierEvent
            ? `border-2 ${meta.eventAccentClass} animate-[pulse_2.4s_ease-in-out_infinite] motion-reduce:animate-none`
            : `border border-slate-800 border-l-[3px] ${meta.borderClass}`
      }`}
```

- [ ] **Step 7: Replace the progress caption with the fixed dual-piece format, and add the Primal secondary track**

Replace:

```tsx
  const progressCaption = mercyActive
    ? `${data.sinceLastDrop - mercyThreshold} / ${guaranteedAt - mercyThreshold} do garance`
    : `${data.sinceLastDrop} / ${mercyThreshold} do mercy`;
```

with:

```tsx
  const caption = mercyCaption(data.sinceLastDrop, mercyThreshold, guaranteedAt, mercyActive);

  const legendary = data.legendaryTrack;
  const legendaryProgress = legendary
    ? getMercyProgressForConfig(PRIMAL_LEGENDARY_MERCY_CONFIG, legendary.sinceLastDrop)
    : null;
  const legendaryCaption = legendary
    ? mercyCaption(
        legendary.sinceLastDrop,
        PRIMAL_LEGENDARY_MERCY_CONFIG.mercyThreshold,
        legendaryProgress!.guaranteedAt,
        legendaryProgress!.mercyActive,
      )
    : null;
```

Then find the block rendering `<MercyProgressBar ... />` followed by the caption `<div>` (currently: the bar, then `<div className="mt-1 flex items-center justify-between text-[11px] tabular-nums">` with the event countdown on the left and `progressCaption` on the right). Replace the caption line's right-hand `<span>{progressCaption}</span>` with:

```tsx
          <span className="text-slate-500">
            <span className="text-slate-400">{caption.primary}</span> · {caption.secondary}
          </span>
```

Immediately after that whole `mb-3` block (the one wrapping `<MercyProgressBar>` + the countdown/caption row) closes, and before the `<div className="flex items-start gap-2">` (log form + action buttons row), insert the Primal secondary track:

```tsx
      {legendary && legendaryProgress && legendaryCaption && (
        <div className="mb-3 border-t border-slate-800 pt-3">
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums text-amber-400">
              {(legendary.currentChance * 100).toFixed(1)}%
            </span>
            <span className="text-[11px] whitespace-nowrap text-slate-500">
              legendary · {legendaryProgress.mercyActive ? 'mercy aktivní' : 'mimo mercy'}
            </span>
          </div>
          <MercyProgressBar
            mercyThreshold={legendaryProgress.mercyThreshold}
            guaranteedAt={legendaryProgress.guaranteedAt}
            preMercyProgress={legendaryProgress.preMercyProgress}
            mercyProgress={legendaryProgress.mercyProgress}
            fillClass="bg-amber-500"
            neonBgClass="bg-amber-400"
            neonGlowClass="shadow-[0_0_10px_2px_rgba(251,191,36,0.8)]"
          />
          <div className="mt-1 text-[11px] tabular-nums text-slate-500">
            <span className="text-slate-400">{legendaryCaption.primary}</span> · {legendaryCaption.secondary}
          </div>
        </div>
      )}
```

- [ ] **Step 8: Wire the widened `onConfirmDrop`/`onCorrect` calls through to modals**

This step is completed by Tasks 10 and 11 (they define what `rarity` the modals pass back) — for now, update the two call sites inside `ShardCard.tsx` to forward whatever the modal gives them:

Find:

```tsx
          onConfirm={async (championName, extraChampionName) => {
            await onConfirmDrop(data.shardType, championName, extraChampionName || undefined);
            setCelebrating(false);
          }}
```

Replace with:

```tsx
          onConfirm={async (championName, extraChampionName, rarity) => {
            await onConfirmDrop(data.shardType, championName, extraChampionName || undefined, rarity);
            setCelebrating(false);
          }}
```

Find the `<EditCountModal ... onSubmit={onCorrect} .../>` usage and confirm it still compiles once Task 11 widens `EditCountModal`'s `onSubmit` prop type — no change needed here since `onCorrect` is passed through directly and TypeScript will infer the widened signature once Task 11 lands.

- [ ] **Step 9: Typecheck**

```bash
npx tsc --noEmit -p apps/web
```

Expected: errors remaining only in `DropCelebrationModal.tsx`/`EditCountModal.tsx` (Tasks 10/11 not done yet) — `ShardCard.tsx` itself should be clean.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/ShardCard.tsx
git commit -m "web: redesign ShardCard — icon slot, no rarity pill, fixed mercy caption, Primal dual track"
```

---

### Task 9: Dashboard.tsx — responsive density (dense on mobile, roomy on desktop)

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: nothing new — this task only adjusts Tailwind classes on the existing grid container.

- [ ] **Step 1: Read the current file**

Read `apps/web/src/components/Dashboard.tsx` — the change is localized to the shard grid's className.

- [ ] **Step 2: Force a true single-column stack below `sm`**

Find:

```tsx
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
```

Replace with:

```tsx
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] sm:gap-4">
```

- [ ] **Step 3: Shrink `ShardCard`'s own padding and hero number below `sm`**

This is the other half of the mobile-density fix — the grid change alone doesn't shrink each card's height. Read `apps/web/src/components/ShardCard.tsx` (already touched in Task 8) and make two more responsive tweaks:

Find the outermost card `<div>`'s className (starts `rounded-xl bg-slate-900 p-4 ...`) and change `p-4` to `p-3 sm:p-4`.

Find the hero chance number:

```tsx
        <span className="text-2xl font-bold tabular-nums">{currentChancePct}%</span>
```

Replace with:

```tsx
        <span className="text-xl font-bold tabular-nums sm:text-2xl">{currentChancePct}%</span>
```

Together with Task 8's responsive icon slot, this measurably shrinks each card's height on phone-width viewports without a separate dense-card component — the same JSX just carries less padding and a smaller hero number below the `sm` breakpoint.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p apps/web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx apps/web/src/components/ShardCard.tsx
git commit -m "web: single-column mobile grid + denser card padding/hero-number below sm"
```

---

### Task 10: DropCelebrationModal — rarity picker for Primal

**Files:**
- Modify: `apps/web/src/components/DropCelebrationModal.tsx`

**Interfaces:**
- Consumes: `fetchChampionSuggestions(shardType, rarity?)` (Task 5).
- Produces: `onConfirm(championName, extraChampionName, rarity?: 'LEGENDARY' | 'MYTHICAL')` — Task 8 already forwards this through.

- [ ] **Step 1: Read the current file in full**

- [ ] **Step 2: Add a `dualRarity` prop and rarity state**

Change the props interface:

```tsx
interface DropCelebrationModalProps {
  title: string;
  shardType: ShardType;
  extraLegendaryActive: boolean;
  /** True only for Primal — shows a Mythical/Legendary picker before the champion field. */
  dualRarity: boolean;
  onConfirm: (championName: string, extraChampionName: string, rarity?: 'LEGENDARY' | 'MYTHICAL') => Promise<void>;
  onCancel: () => void;
}
```

Change the component signature and add rarity state, defaulting to Mythical (Primal's main track):

```tsx
export function DropCelebrationModal({
  title,
  shardType,
  extraLegendaryActive,
  dualRarity,
  onConfirm,
  onCancel,
}: DropCelebrationModalProps) {
  const [rarity, setRarity] = useState<'LEGENDARY' | 'MYTHICAL'>('MYTHICAL');
  const [championName, setChampionName] = useState('');
  const [extraChampionName, setExtraChampionName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [primaryUnknown, setPrimaryUnknown] = useState(false);
  const [extraUnknown, setExtraUnknown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChampionSuggestions(shardType, dualRarity ? rarity : undefined)
      .then(setSuggestions)
      .catch(() => {});
  }, [shardType, dualRarity, rarity]);
```

- [ ] **Step 3: Reset the champion name when the rarity toggle changes**

Add, near the existing `extraLegendaryActive` reset effect:

```tsx
  useEffect(() => {
    if (dualRarity) {
      setChampionName('');
      setPrimaryUnknown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarity]);
```

- [ ] **Step 4: Pass `rarity` through `handleConfirm`**

Replace:

```tsx
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
```

with:

```tsx
  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(championName.trim(), extraChampionName.trim(), dualRarity ? rarity : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset se nezdařil');
      setSubmitting(false);
    }
  };
```

- [ ] **Step 5: Render the picker above the champion field, only when `dualRarity`**

Insert right after the `<p className="mb-4 text-sm text-slate-400">...</p>` line (before `<ChampionAutocompleteField label="Jméno šampiona...`):

```tsx
        {dualRarity && (
          <div className="mb-3 flex rounded-lg border border-slate-700 bg-slate-800 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setRarity('MYTHICAL')}
              disabled={submitting}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                rarity === 'MYTHICAL' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mythical
            </button>
            <button
              type="button"
              onClick={() => setRarity('LEGENDARY')}
              disabled={submitting}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                rarity === 'LEGENDARY' ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Legendary
            </button>
          </div>
        )}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p apps/web
```

Expected: errors remaining only in `ShardCard.tsx`'s `<DropCelebrationModal>` usage (missing the new required `dualRarity` prop) and `EditCountModal.tsx` (Task 11) — fix the `ShardCard.tsx` call site now:

In `apps/web/src/components/ShardCard.tsx`, find the `<DropCelebrationModal ...>` element and add:

```tsx
          dualRarity={data.shardType === 'PRIMAL'}
```

as a prop (alongside `shardType={data.shardType}` etc).

- [ ] **Step 7: Re-typecheck**

```bash
npx tsc --noEmit -p apps/web
```

Expected: errors remaining only in `EditCountModal.tsx` (Task 11).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/DropCelebrationModal.tsx apps/web/src/components/ShardCard.tsx
git commit -m "web: Mythical/Legendary picker in the drop celebration modal for Primal"
```

---

### Task 11: EditCountModal — second field for Primal's Legendary track

**Files:**
- Modify: `apps/web/src/components/EditCountModal.tsx`
- Modify: `apps/web/src/components/ShardCard.tsx`

**Interfaces:**
- Consumes: `onSubmit(shardType, value, gotDrop, rarity?)` (Task 5's widened `onCorrect`).
- Produces: nothing further downstream — this is the last modal.

- [ ] **Step 1: Read the current file in full**

- [ ] **Step 2: Add an optional secondary-track prop**

Change the props interface:

```tsx
interface EditCountModalProps {
  shardType: ShardType;
  currentValue: number;
  dropFlagLabel: string;
  /** Primal only: current Legendary-track value, to show the second field. */
  legendaryValue?: number;
  onClose: () => void;
  onSubmit: (shardType: ShardType, value: number, gotDrop: boolean, rarity?: 'LEGENDARY' | 'MYTHICAL') => Promise<void>;
}
```

- [ ] **Step 3: Add legendary-field state, alongside the existing state**

```tsx
export function EditCountModal({ shardType, currentValue, dropFlagLabel, legendaryValue, onClose, onSubmit }: EditCountModalProps) {
  const [value, setValue] = useState(String(currentValue));
  const [gotDrop, setGotDrop] = useState(false);
  const hasLegendaryTrack = legendaryValue !== undefined;
  const [legendaryValueInput, setLegendaryValueInput] = useState(String(legendaryValue ?? 0));
  const [legendaryGotDrop, setLegendaryGotDrop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const isValid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0;
  const legendaryParsed = Number(legendaryValueInput);
  const isLegendaryValid =
    !hasLegendaryTrack || (legendaryValueInput.trim() !== '' && Number.isInteger(legendaryParsed) && legendaryParsed >= 0);
```

- [ ] **Step 4: Submit both tracks when present**

Replace `handleSubmit`:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !isLegendaryValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(shardType, parsed, gotDrop);
      if (hasLegendaryTrack) {
        await onSubmit(shardType, legendaryParsed, legendaryGotDrop, 'LEGENDARY');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úprava se nezdařila');
      setSubmitting(false);
    }
  };
```

- [ ] **Step 5: Render the second field block, only when `hasLegendaryTrack`**

Insert right after the existing `<label className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">...gotDrop checkbox...</label>` block, still inside the `<form>`:

```tsx
          {hasLegendaryTrack && (
            <>
              <p className="mt-4 mb-1.5 text-xs font-semibold text-amber-400">Legendary track</p>
              <input
                type="number"
                min={0}
                step={1}
                value={legendaryValueInput}
                onChange={(e) => setLegendaryValueInput(e.target.value)}
                disabled={submitting}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-slate-100 focus:border-amber-500 focus:outline-none"
              />
              <label className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={legendaryGotDrop}
                  onChange={(e) => setLegendaryGotDrop(e.target.checked)}
                  disabled={submitting}
                  className="h-3.5 w-3.5"
                />
                padl legendary v této dávce
              </label>
            </>
          )}
```

- [ ] **Step 6: Update the button's disabled condition**

Replace `disabled={!isValid || submitting}` on the submit `<button>` with `disabled={!isValid || !isLegendaryValid || submitting}`.

- [ ] **Step 7: Pass `legendaryValue` from `ShardCard.tsx`**

In `apps/web/src/components/ShardCard.tsx`, find the `<EditCountModal ...>` element and add:

```tsx
          legendaryValue={data.legendaryTrack?.sinceLastDrop}
```

as a prop.

- [ ] **Step 8: Typecheck the whole frontend**

```bash
npx tsc --noEmit -p apps/web
```

Expected: PASS, 0 errors — every caller from Tasks 5-11 should now line up.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/EditCountModal.tsx apps/web/src/components/ShardCard.tsx
git commit -m "web: second Legendary field in the edit-count modal for Primal"
```

---

### Task 12: HistoryTab — Primal rows show their actual rarity

**Files:**
- Modify: `apps/web/src/components/HistoryTab.tsx`

**Interfaces:**
- Consumes: `DropRecord.rarity` (Task 5).

- [ ] **Step 1: Read the current file (already read once above — re-read if context was compacted)**

- [ ] **Step 2: Compute the label/pill class from `drop.rarity` when present**

Inside `DropRow`, replace:

```tsx
function DropRow({ drop }: { drop: DropRecord }) {
  const meta = SHARD_META[drop.shardType];
```

with:

```tsx
function DropRow({ drop }: { drop: DropRecord }) {
  const meta = SHARD_META[drop.shardType];
  const dropLabel = drop.rarity ? drop.rarity.toLowerCase() : meta.dropLabel;
  const pillClass = drop.rarity === 'LEGENDARY' ? 'bg-amber-400/15 text-amber-400' : meta.pillClass;
```

Then replace the pill's JSX:

```tsx
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${meta.pillClass}`}>
          {meta.dropLabel}
        </span>
```

with:

```tsx
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${pillClass}`}>
          {dropLabel}
        </span>
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p apps/web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/HistoryTab.tsx
git commit -m "web: History tab shows Primal's actual drop rarity, not always mythical"
```

---

### Task 13: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Full mercy-calc test suite**

```bash
npm run test -w @rsl/mercy-calc
```

Expected: PASS, 0 failures.

- [ ] **Step 2: Full workspace build**

```bash
npm run build -w @rsl/mercy-calc -w @rsl/server-core
npx tsc --noEmit -p apps/web
```

Expected: all green.

- [ ] **Step 3: Start the dev servers**

```bash
npm run dev
```

- [ ] **Step 4: Manual walkthrough in the browser preview**

- Load the dashboard: confirm every shard card shows the icon slot (no colored dot), no LEGENDARY/MYTHICAL pill, and the new caption format (`N otevřených · ještě M do mercy/garance`).
- On the Primal card specifically: confirm the Legendary sub-track renders below a divider with its own amber bar and caption.
- Log a batch of shards on Primal ("Přidat") — confirm both the Mythical and Legendary "otevřených" counts increase by the same amount.
- Open the celebration modal on Primal, confirm the Mythical/Legendary toggle appears, switch to Legendary, confirm the champion suggestions list changes, submit a drop — confirm only the Legendary counter resets to 0 and the Mythical one is untouched.
- Open the edit-count modal on Primal — confirm both fields appear and both persist independently.
- Check the History tab: confirm a Primal Legendary drop shows a "legendary" pill (amber), not "mythical".
- Resize to a narrow (mobile) viewport: confirm the shard grid is a single column and cards read comfortably without excess whitespace.
- Toggle `prefers-reduced-motion` (via browser dev tools rendering emulation) and confirm the event glow stops animating.

- [ ] **Step 5: Report results**

If any step in the manual walkthrough fails, stop and fix before considering this plan done — do not report success without having actually driven the browser through these steps.

---
