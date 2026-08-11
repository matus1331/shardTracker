# Extra Legendary Event — Design

## Context

The app already supports scheduling "2x events" (internally `mercy_events`): an admin picks shard type(s) + a UTC time range, and while active the drop chance shown for that shard is doubled (via a `multiplier` field). This is purely a chance-display effect — it never changes how many drops are counted.

We're adding a second, distinct event type: **Extra Legendary**. Unlike the 2x event, it does not touch drop chance at all. Instead: if a legendary drop happens while it's active, the player got *two* legendary champions from that single shard opening, and the app needs to let them log both and count both correctly in stats/history.

## Requirements (confirmed with user)

- Extra Legendary applies only to the three legendary-drop shards: **Ancient, Void, Sacred** (not Primal — Primal drops mythical, not legendary; not Remnant, which isn't event-eligible today either).
- On a given shard, only one event can be active at a time, regardless of type — a 2x event and an Extra Legendary event must never overlap on the same shard/time range.
- Extra Legendary must not alter `currentChance` / mercy progress calculation in any way.
- When active, the drop-confirmation modal (`DropCelebrationModal`) shows a second, **optional** champion select ("Extra lego") beneath the primary one. Leaving it empty logs a normal single drop.
- When both are filled, the app must count **2** drops from that single confirmation action in `lifetime_drops` and in drop history — without consuming any extra "since last drop" / pity progress (it's a bonus from the same opening, not a second shard opened).
- The event needs an "original" way of being marked as active/visible on the shard card, visually distinct from the existing 2x badge — inspired by (not copied from) the in-game "Extra Legendary Event" splash (a gold/fire-toned legendary gem+helm icon), using an original icon/color scheme rather than reproducing the actual copyrighted game artwork.
- No new dedicated stats section is needed (no "Extra Legendary efektivita" breakdown analogous to the existing "2× efektivita" section) — it's sufficient that counts and history are correct.

## 1. Data model

### Event scheduling — extend `mercy_events`, don't add a new table

Add a `kind` column to the existing `mercy_events` table:

```sql
ALTER TABLE mercy_events ADD COLUMN kind TEXT NOT NULL DEFAULT 'MULTIPLIER'
  CHECK (kind IN ('MULTIPLIER', 'EXTRA_LEGENDARY'));
```

Rationale: reuses all existing scheduling/admin plumbing (`group_id` grouping, start/end validation, list/delete-by-group). Because events of *either* kind must never overlap for the same shard, keeping everything in one table means the overlap check is a single query against one index (`shard_type, start_at, end_at`) — a second table would need a cross-table check instead.

For `EXTRA_LEGENDARY` rows, `multiplier` is stored but ignored everywhere it matters (effectively treated as `1.0`).

### Extra champion on a drop — extend `shard_batches`, don't add a second row

```sql
ALTER TABLE shard_batches ADD COLUMN extra_champion_name TEXT;
ALTER TABLE shard_batches ADD COLUMN extra_champion_id INTEGER REFERENCES champions(hero_id);
```

One drop-confirmation action stays one `shard_batches` row (matching the existing `correctSinceLastDrop` model), optionally carrying a second champion. This avoids inventing a "linked pair of rows" concept and avoids having to special-case a second row's `since_last_drop_before/after`/`lifetime_opened` bookkeeping for something that isn't a second shard opening.

## 2. Backend logic

**Scheduling (`POST /api/events`)**: accepts a new `kind` field. When `kind === 'EXTRA_LEGENDARY'`:
- `shardTypes` validated against `['ANCIENT', 'VOID', 'SACRED']` only (not the existing `SUPPORTED_EVENT_SHARD_TYPES`, which includes `PRIMAL`).
- `multiplier` ignored / not accepted from the client, stored as `1.0`.
- Overlap validation checks existing `mercy_events` rows for that shard/time-range **regardless of `kind`** (both kinds share one exclusivity domain per shard).

**Chance calculation (`withChance` in `routes/shards.ts`)**: only applies `multiplier` to `calculateDropChance`/`getMercyProgress` when the active event's `kind === 'MULTIPLIER'`. For `EXTRA_LEGENDARY`, chance/progress is computed exactly as if no event were active (multiplier effectively 1). The `activeEvent` object returned to the client includes `kind` so the frontend can branch on it.

**Drop confirmation (`correctSinceLastDrop`)**: gains an optional `extraChampionName` parameter.
- Resolved to `extra_champion_id` via the `champions` table lookup, same as the existing `championName` → `champion_id` resolution.
- When present: `lifetime_drops` increments by **2** instead of 1.
- `since_last_drop` / `lifetime_opened` update logic is unchanged — the extra champion does not consume additional pity progress or count as an additional shard opened.

## 3. Admin UI (`EventsAdminModal`)

Add an event-type toggle at the top of the existing scheduling form ("2x event" / "Extra Legendary event") rather than a separate modal:

- Selecting **Extra Legendary** restricts the shard checkboxes to Ancient/Void/Sacred and hides/disables the multiplier field — everything else (shard multi-select, UTC start/end pickers, optional label) is unchanged.
- The existing scheduled/active events list (grouped by `groupId`) gains a small type tag per group ("2x" / "Extra Legendary") so the admin view stays legible with two event kinds mixed together.

## 4. Shard card visual design (active-event indicator)

Inspired by the in-game Extra Legendary splash's gold/fire palette, expressed as an **original** icon/color treatment (not a reproduction of the copyrighted game asset):

- **Badge**: a new pulsing pill using an amber-to-crimson/orange fire gradient (distinct hue from the existing amber-to-yellow "⚡ 2×" pill), e.g. "🔥 EXTRA LEGO" or a small original inline SVG (faceted gem + flame lick) alongside the text.
- **Card border/glow**: unlike the 2x event's border (which is shard-color-matched via `meta.eventAccentClass` — blue/violet/amber depending on shard), the Extra Legendary border uses a **fixed ember/fire palette** (orange-red glow) regardless of which shard it's on. This gives the event a consistent visual identity across Ancient/Void/Sacred, mirroring how the in-game event has one consistent look independent of shard type.
- **Countdown**: same `formatEventCountdown` formatting, rendered in the fire color instead of amber.
- Because events never overlap per shard, a card only ever needs to render one event treatment at a time — no need to handle both badges simultaneously.

## 5. Drop confirmation modal (`DropCelebrationModal`)

- `ShardCard` passes the active event's `kind` down to the modal (it already has `data.activeEvent`).
- When `kind === 'EXTRA_LEGENDARY'`, a second autocomplete field "Extra lego" renders below the primary champion field, using the same suggestion/warning mechanism as the primary field, styled with the fire accent from §4 to visually tie it to the active event.
- The field is **optional** — leaving it blank confirms a normal single drop (`extraChampionName` sent as `null`).
- `onConfirm` signature becomes `(championName, extraChampionName?) => Promise<void>`, forwarded through `useShardData` to `correctSinceLastDrop`.

## 6. History & stats display

- **`HistoryTab`**: when a drop record has `extraChampionName`, render it as a second champion chip (with its own HellHades link if resolved) next to the primary one, and show the new "🔥 EXTRA LEGO" tag (§4 palette) instead of the "⚡ 2×" tag — the two tags are mutually exclusive per the no-overlap rule.
- **`StatsTab`**: no new section. `LuckIndexCard` and other aggregate counts work unchanged because `lifetime_drops` is already correct at write-time (§2). The existing "2× efektivita" (`EventEfficiencyRow`) section stays scoped to `MULTIPLIER`-kind events only.
- **Type changes**:
  - `ActiveMercyEvent` gains `kind: 'MULTIPLIER' | 'EXTRA_LEGENDARY'`.
  - `DropRecord` gains `extraChampionName: string | null`, `extraChampionUrl: string | null`.

## Out of scope

- No dedicated "Extra Legendary efektivita" stats breakdown (explicitly declined).
- No support for Extra Legendary on Primal or Remnant shards.
- No support for overlapping events (of either kind) on the same shard.
