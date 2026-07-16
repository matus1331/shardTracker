# RSL Shard Tracker

Personal web app for manually logging shard openings in *Raid: Shadow Legends* and tracking each shard type's "mercy" pity chance. Multi-user (username/password auth, per-user data isolation), PWA-installable, deployed live on Vercel with a Turso (libSQL) database.

Live: https://shard-tracker-web.vercel.app/
Repo: git@github.com:matus1331/shardTracker.git (branch `main`, Vercel auto-deploys on push)

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS v4, `vite-plugin-pwa`.
- **Backend**: Fastify 5, `@fastify/cookie` for sessions.
- **Database**: Turso (SQLite-compatible libSQL) via `@libsql/client`. Local dev uses a file-mode libSQL DB (zero setup) — **not** `better-sqlite3` (removed; incompatible with serverless hosting, see Gotchas).
- **Auth**: username/password, `node:crypto` scrypt hashing, opaque session tokens in an httpOnly cookie (DB-backed session table, no JWT).
- **Monorepo**: npm workspaces (`packages/*`, `apps/*`).
- **Hosting**: single Vercel project — static Vite frontend + one Fastify-wrapped serverless function, same origin (no CORS).

## Repo structure

```
packages/
  mercy-calc/       # pure domain logic: per-shard mercy/pity formula. No I/O. Used by FE + BE.
  server-core/      # Fastify app factory + DB access + auth + routes. Used by both the local
                     # dev server AND the Vercel function — this is the actual backend.
apps/
  server/           # thin local-dev entrypoint: imports server-core's buildApp(), calls .listen().
                     # Not deployed — Vercel only deploys apps/web.
  web/              # the actual deployed app.
    src/            # React app
    api/server.ts   # Vercel serverless entrypoint — wraps the SAME server-core Fastify app
    vercel.json     # rewrites /api/:path* -> /api/server (see Gotchas)
```

Both `packages/mercy-calc` and `packages/server-core` **build to `dist/` via `tsc`** (root `postinstall` hook runs `npm run build -w @rsl/mercy-calc -w @rsl/server-core` automatically after every `npm install`). Their `package.json` `"main"` points at `dist/index.js`, not `src/index.ts` — see Gotcha #1, this is not optional.

## Local dev

```bash
npm install     # also builds mercy-calc + server-core dist/ via postinstall
npm run dev      # server (Fastify, :3001) + web (Vite, :5173) concurrently, Vite proxies /api -> :3001
npm test         # mercy-calc vitest suite (the only package with tests)
```

No `.env` needed locally — `packages/server-core/src/db.ts` defaults `DATABASE_URL` to `file:./data/rsl.db` (relative to `apps/server`, gitignored) when unset.

**Important workflow gotcha**: `apps/server` and `apps/web/api/server.ts` both import `@rsl/server-core` and `@rsl/mercy-calc` via their compiled `dist/` output (not live TS source). Editing `packages/*/src/**` will **not** hot-reload — you must rerun `npm run build -w @rsl/mercy-calc -w @rsl/server-core` (or add `--watch` to the individual package's `tsc` build) before the dev servers pick up the change. `apps/web/src/**` (the React app itself) is unaffected — Vite handles that live as normal.

## Deployment

- **Vercel project**: Root Directory = `apps/web`. Requires **"Include source files outside of the Root Directory in the Build Step"** enabled (Project Settings → General) since `apps/web/api/server.ts` imports `packages/server-core`, which lives outside `apps/web`.
- **Env vars** (Vercel → Settings → Environment Variables, Production + Preview): `DATABASE_URL` (`libsql://...` from `turso db show <name> --url`), `DATABASE_AUTH_TOKEN` (from `turso db tokens create <name>`).
- Push to `main` → Vercel auto-builds and deploys.

## Gotchas discovered the hard way (read before touching deploy config)

1. **Workspace packages must ship compiled JS, not raw `.ts`.** `packages/mercy-calc` and `packages/server-core` originally had `"main": "src/index.ts"` (fine locally — tsx/Vite transpile on the fly). Vercel's function bundler treats workspace deps as external `node_modules` packages and tries to `import` them with plain Node — raw `.ts` isn't executable, causing `ERR_MODULE_NOT_FOUND` in production only. Fix: both packages have a `build` script (`tsc`, plus a `cp` step for server-core's migration SQL which `tsc` doesn't copy) and `"main"` points at `dist/`. The root `postinstall` hook keeps `dist/` fresh automatically.
2. **Vercel's `/api` directory does not support Next.js-style bracket catch-all routes (`[...path].ts`) outside Next.js.** A file named `api/[...path].ts` silently builds but maps to a literal (unmatched) path, so every real request 404s at Vercel's edge (`x-vercel-error: NOT_FOUND`) — no build error, no runtime log, just silence. Fix in place: the function is named `api/server.ts` (unambiguous literal path) and `apps/web/vercel.json` has a rewrite (`/api/:path*` → `/api/server`) forwarding all API traffic to it.
3. **Cross-package ambient TypeScript declarations don't auto-propagate.** `request.profileId` is added via `declare module 'fastify'` in `packages/server-core/src/fastify-augment.d.ts`. Any package that imports `server-core` and runs its own standalone `tsc --noEmit` needs that ambient declaration explicitly part of *its own* compilation's root file set — TS doesn't pick up ambient `.d.ts` files merely reached transitively via imports. Current workaround: `apps/server` has its own duplicate copy of the file in `src/` (picked up by its normal `"include": ["src"]`); `apps/web/tsconfig.json` instead references `server-core`'s copy directly via a relative path in `"include"`. Either approach works — if you add a third consumer, do one of these two, not neither (you'll get silent `Property 'profileId' does not exist` errors otherwise).
4. **`better-sqlite3` is gone on purpose.** Do not reintroduce a local-file synchronous SQLite driver for anything that needs to survive a deploy — Vercel functions (and most free-tier PaaS free web services, e.g. Render) have ephemeral filesystems; local files are wiped on every cold start/redeploy. All persistence goes through `@libsql/client` (Turso in prod, local file in dev via the same driver).

## Data model (in `packages/server-core/src/migrations/001_init.sql`)

- `profiles` — `id`, `username` (unique), `password_hash` (`scrypt` salt:hash, see `packages/server-core/src/auth.ts`).
- `sessions` — `token` (PK, opaque random bearer, sent as httpOnly cookie), `profile_id`. No expiry logic (sessions live until logout) — a known simplification, not a bug.
- `shard_counters` — one row per `(profile_id, shard_type)`: `since_last_drop` (mercy counter, resets on a logged drop), `lifetime_opened`, `lifetime_drops` (never reset).
- `shard_batches` — append-only audit log of every add/correction (not currently surfaced in the UI, but there for future history/undo features).

## Mercy formula (single source of truth: `packages/mercy-calc/src/calculate.ts`)

Chance stays at `baseChance` until `mercyThreshold` shards have been opened since the last drop; **every shard past the threshold** adds `bonusPerShard` (linear ramp, not a step function), capped at 100%.

| Shard | Tracks | Base | Threshold | Bonus/shard past threshold | Guaranteed at |
|---|---|---|---|---|---|
| Ancient | Legendary | 0.5% | 200 | +5% | 220 |
| Void | Legendary | 0.5% | 200 | +5% | 220 |
| Primal | Mythical | 0.5% | 200 | +10% | 210 |
| Sacred | Legendary | 6% | 12 | +2% | 59 |
| Remnant | Mythical | 2.5% | 24 | +1% | 122 |

`getMercyProgress()` derives the two-phase progress bar (pre-mercy progress to threshold, then mercy-active progress to guaranteed pull) that `apps/web/src/components/MercyProgressBar.tsx` renders — do not reintroduce a "reset every N shards" step-function reading of this, it was an earlier bug (see git history if curious).

## Key files when extending this app

- `packages/mercy-calc/src/calculate.ts` — the formula. Change shard mercy numbers here only; both FE display and BE-computed `currentChance` read from this one place.
- `packages/server-core/src/repository.ts` — all DB queries (async, libSQL). `addShards`/`correctSinceLastDrop`/`createProfile` use interactive libSQL transactions (`client.transaction('write')` + manual commit/rollback).
- `packages/server-core/src/app.ts` — `buildApp()` Fastify factory (cookie plugin, session lookup hook, route registration). Both `apps/server/src/index.ts` (local) and `apps/web/api/server.ts` (Vercel) call this — keep it the single place request handling is wired up.
- `apps/web/src/types.ts` — `SHARD_META`: per-shard colors/labels/celebration copy (frontend-only, not shared with backend).
- `apps/web/src/auth/AuthContext.tsx` — frontend auth state (`useAuth()`); gates `App.tsx` between `LoginScreen` and `Dashboard`.

## Adding a new shard type

1. Add it to `ShardType`/`SHARD_TYPES` in `packages/mercy-calc/src/types.ts` and its config in `MERCY_CONFIGS` (`calculate.ts`).
2. Add the CHECK constraint value in `packages/server-core/src/migrations/001_init.sql` (both `shard_counters` and `shard_batches` `shard_type` CHECK lists) — existing deployed DBs need this migration re-applied (it's idempotent/`IF NOT EXISTS` but a `CHECK` constraint change on an existing table needs a fresh table or a manual `ALTER`; for local dev just delete `apps/server/data/rsl.db*` and restart).
3. Add a `SHARD_META` entry in `apps/web/src/types.ts` (color classes, labels, celebration copy).
4. No other code changes needed — `SHARD_TYPES` drives seeding, API responses, and the dashboard grid everywhere else.
