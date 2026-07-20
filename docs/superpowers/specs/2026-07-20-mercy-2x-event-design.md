# 2x Event — design spec

Date: 2026-07-20

## Motivation

RSL periodically runs "2x" drop-rate events for specific shard categories (real-world
scheduled events in the game). The tracker should let an admin schedule these events
ahead of time, automatically apply the doubled base chance to the mercy formula while
the event is active, and make the boosted state clearly visible on the affected shard
cards without the player having to check anything manually.

## Scope

- Supported shard types: **ANCIENT, VOID, PRIMAL, SACRED**. **REMNANT is explicitly
  excluded** — it has no 2x event in the game and must not appear in the admin form,
  the DB `CHECK` constraint, or any event-related code path.
- Event definition = a date range (inclusive) + a multiplier applied to the shard's
  `baseChance` only. `bonusPerShard` and `mercyThreshold` are never affected.
- Events are **global** (apply to every profile), but only one admin (identified by
  username) can create/delete them. Regular users only ever see the resulting effect.
- No editing of an existing event — only create and delete. Editing means delete +
  recreate.

## Data model

New migration `packages/server-core/src/migrations/002_mercy_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS mercy_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  shard_type TEXT NOT NULL CHECK (shard_type IN ('ANCIENT', 'VOID', 'PRIMAL', 'SACRED')),
  start_date TEXT NOT NULL,   -- ISO date, e.g. '2026-07-25', inclusive
  end_date TEXT NOT NULL,     -- inclusive
  multiplier REAL NOT NULL DEFAULT 2.0,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mercy_events_group ON mercy_events (group_id);
CREATE INDEX IF NOT EXISTS idx_mercy_events_dates ON mercy_events (shard_type, start_date, end_date);
```

- One row per shard type per event. `group_id` (nanoid) links the rows created
  together from one admin form submission (e.g. selecting Ancient + Void + Sacred at
  once), so the admin UI can list/delete them as a single logical event.
- "Active today" is determined server-side with the DB's own date, e.g.
  `start_date <= date('now') AND end_date >= date('now')`. This is a known
  simplification (like the sessions table's no-expiry design): the day boundary is
  UTC, not the player's local timezone. Acceptable for a casual pity tracker; not
  worth the complexity of per-user timezone handling.

## `packages/mercy-calc` changes

`baseChance` is the only thing a multiplier touches. All three exported functions
gain an optional options bag (default multiplier `1`, i.e. unchanged behavior):

```ts
interface MercyOptions {
  multiplier?: number; // default 1
}

calculateDropChance(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): number
getGuaranteedAt(shardType: ShardType, options?: MercyOptions): number
getMercyProgress(shardType: ShardType, sinceLastDrop: number, options?: MercyOptions): MercyProgress
```

Internally: `effectiveBase = config.baseChance * (options?.multiplier ?? 1)`, then the
existing threshold/ramp/cap math is unchanged, just reading from `effectiveBase`
instead of `config.baseChance`.

**Consequence to document explicitly (not a bug):** because `getGuaranteedAt` solves
for `shardsNeeded = ceil((maxChance - effectiveBase) / bonusPerShard)`, a higher base
chance shifts the guaranteed-pull point earlier. Example — Sacred: normally
`guaranteedAt` = 59 shards (base 6%); with a 2x event (base 12%) it becomes 56. This
must ship as-is; it is the correct behavior of "the new base feeds into the same
formula," matching what was asked for.

`MERCY_CONFIGS` itself is untouched — it remains the single source of truth for the
per-shard numbers; the multiplier is a pure runtime overlay.

## Backend (`packages/server-core`)

**Admin identification**: no DB/schema change. `process.env.ADMIN_USERNAME` (new env
var, set in Vercel + optionally a local `.env`) is compared against the logged-in
profile's username. Helper `isAdmin(username: string | undefined): boolean` used by
route guards and by the `/api/auth/*` responses.

**`/api/auth/register`, `/api/auth/login`, `/api/auth/me`** — response gains
`isAdmin: boolean` alongside the existing `username` field, so the frontend
`AuthContext` can gate the admin UI without a separate request.

**New `packages/server-core/src/routes/events.ts`**:
- `GET /api/events` — admin only (403 otherwise). Returns all events (past, active,
  future), grouped by `group_id` for the admin list view.
- `POST /api/events` — admin only. Body: `{ shardTypes: ShardType[], startDate: string, endDate: string, label?: string }`.
  Validates every `shardType` is one of the 4 supported types, `startDate <= endDate`.
  Inserts one row per shard type sharing a freshly generated `group_id`, in a single
  transaction (same interactive-transaction pattern as `addShards`).
- `DELETE /api/events/:groupId` — admin only. Deletes all rows sharing that
  `group_id`.

**`packages/server-core/src/routes/shards.ts` changes**: `withChance` currently only
computes `currentChance`. It's extended to also look up, per shard type, whether an
event is active today (one query against `mercy_events` for the four supported
types, done once per `/api/shards` request — not per row), and attach:

```ts
{
  ...row,
  currentChance: calculateDropChance(row.shardType, row.sinceLastDrop, { multiplier }),
  activeEvent: activeEvent ? { multiplier: activeEvent.multiplier, endDate: activeEvent.endDate, label: activeEvent.label } : null,
}
```

This means the frontend never needs to independently fetch or date-match events for
the dashboard — one API call carries everything `ShardCard` needs, keeping the
"active today" decision in one place (the server).

## Frontend (`apps/web`)

**Types** (`apps/web/src/types.ts`): `ShardCounterState` gains
`activeEvent: { multiplier: number; endDate: string; label?: string } | null`.

**`AuthContext`**: exposes `isAdmin` from the `/api/auth/me` payload.

**Admin UI**: a lightning/calendar icon button next to `UserMenu`, rendered only
when `isAdmin`. Opens `EventsAdminModal`:
- List of all events (from `GET /api/events`), grouped by `group_id`, active ones
  visually distinguished (gold border), past ones dimmed. Each group has a Smazat
  (delete) button.
- "+ Naplánovat event" form: checkboxes for the 4 supported shard types, grouped
  visually under "Legendary" (Ancient, Void, Sacred) and "Mythical" (Primal) with a
  one-click "select category" shortcut; `start_date`/`end_date` via native
  `<input type="date">`; optional label text field. Multiplier is fixed at 2 in the
  UI (not exposed as an input) even though the DB column supports arbitrary values
  for future flexibility.
- Regular (non-admin) users never see this icon or these routes' data.

**`ShardCard.tsx` visual treatment** (all 4 elements, to be fine-tuned once seen
live):
1. **Badge**: a second pill next to the existing rarity pill (top-right), reading
   "⚡ 2×", amber/gold gradient background, distinct from all 4 existing per-shard
   accent colors (including Sacred's amber dot — the event badge uses a visibly
   different gold tone/gradient so the two don't blend), subtle `animate-pulse` glow
   (opacity/box-shadow only, never width/height), respecting
   `prefers-reduced-motion`.
2. **Before → after chance**: when `activeEvent` is set, the big percentage number
   is preceded by the un-boosted base chance (read from `MERCY_CONFIGS` client-side,
   no API change needed for this part) struck through, then an arrow, then the
   boosted value in bold — e.g. `0.5% → 1.0%`.
3. **Countdown caption**: a gold-colored line under the progress bar, e.g.
   "⚡ 2x event · končí za 2 dny" / "… končí dnes" (Czech pluralization: 1 den / 2–4
   dny / 5+ dní), computed from `activeEvent.endDate` vs. the client's local today
   (cosmetic only — the authoritative "is it active" decision already happened
   server-side).
4. **Card-level accent**: a soft gold ring around the whole card
   (`ring-1 ring-amber-400/40` or similar) so boosted cards are distinguishable at a
   glance across the dashboard grid, without disturbing existing layout.

`getMercyProgress` is called from `ShardCard` with
`{ multiplier: data.activeEvent?.multiplier ?? 1 }` so the progress bar segments
stay mathematically consistent with the server-computed `currentChance` and with the
shifted `guaranteedAt`. `LogShardsForm`'s `maxAmount={guaranteedAt - sinceLastDrop}`
picks this up automatically since `guaranteedAt` is computed from the same
multiplier-aware call.

All new UI copy is Czech, per the project's localization convention.

## Explicit assumptions / simplifications

- "Active today" is a server-UTC calendar-day check, not per-player-timezone. Same
  category of simplification as the sessions table's no-expiry design.
- Events never retroactively change historical `shard_batches` rows or past mercy
  math — they only affect what's computed/displayed *while* active. The mercy
  counter (`since_last_drop`) itself is date-agnostic already, so this requires no
  special handling.
- No event editing — delete + recreate covers the "oops, wrong date" case, avoiding
  a second form/mutation path for a personal-scale admin tool.
- The DB `multiplier` column is more general than the UI (which only ever writes
  `2.0`), matching the existing pattern of "column supports it, UI doesn't need to
  expose it yet."

## Testing

- `packages/mercy-calc` (vitest, the only package with existing tests): add cases for
  `calculateDropChance`, `getGuaranteedAt`, and `getMercyProgress` with a `multiplier`
  option — verify base doubling, verify the ramp/cap math is unaffected, and verify
  the `guaranteedAt` shift (e.g. Sacred 59 → 56 at 2x).
- No existing backend or frontend test infra to extend beyond that; admin-gating and
  UI behavior get manual verification (dev server, as an admin user and as a regular
  user) before merge, per the project's established practice.
