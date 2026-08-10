// Manual, one-off/occasional import — NOT run at request time or during build.
// Fetches HellHades' own (undocumented, unauthenticated) champion feed and upserts a
// trimmed local snapshot (name/rarity/faction/affinity/url only — no HellHades rating
// data) into the `champions` table. Re-run whenever new champions are added to the game.
//
// This script runs from this package's own directory, NOT apps/server, so DATABASE_URL
// must be passed explicitly or it will create/read packages/server-core/data/rsl.db
// instead of the app's usual local dev DB. Examples:
//
//   DATABASE_URL=file:../../apps/server/data/rsl.db npm run import-champions -w @rsl/server-core
//   DATABASE_URL=libsql://<db>.turso.io DATABASE_AUTH_TOKEN=<token> npm run import-champions -w @rsl/server-core

import { upsertChampions, type ChampionImportRow } from '../repository.js';

const CHAMPIONS_ENDPOINT = 'https://hellhades.com/wp-json/hh-api/v3/champions?mode=full&faction=';

interface HellHadesChampion {
  heroId?: number;
  champion?: string;
  shortname?: string;
  rarity?: string;
  affinity_index?: string;
  faction_index?: string;
  url?: string;
}

interface HellHadesResponse {
  champions: HellHadesChampion[];
  pagination?: { page?: number; totalPages?: number; total?: number };
}

function toImportRow(c: HellHadesChampion): ChampionImportRow | null {
  if (!c.heroId || !c.champion || !c.url) return null;
  const rarity = c.rarity?.toUpperCase();
  if (rarity !== 'LEGENDARY' && rarity !== 'MYTHICAL') return null;
  return {
    heroId: c.heroId,
    name: c.champion,
    shortname: c.shortname ?? c.champion,
    rarity,
    affinity: c.affinity_index ?? null,
    faction: c.faction_index ?? null,
    hellhadesUrl: c.url,
  };
}

async function main() {
  const res = await fetch(CHAMPIONS_ENDPOINT);
  if (!res.ok) {
    throw new Error(`HellHades champions request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as HellHadesResponse;
  const fetched = data.champions ?? [];

  const rows: ChampionImportRow[] = [];
  let skipped = 0;
  for (const c of fetched) {
    const row = toImportRow(c);
    if (row) {
      rows.push(row);
    } else if (c.rarity?.toUpperCase() === 'LEGENDARY' || c.rarity?.toUpperCase() === 'MYTHICAL') {
      // Only warn on rows that were the right rarity but missing required fields —
      // Epic/Rare/etc. are expected to be skipped silently, that's the normal filter.
      skipped += 1;
      console.warn('Skipping champion with missing fields:', c);
    }
  }

  await upsertChampions(rows);
  console.log(
    `Fetched ${fetched.length} champions, upserted ${rows.length} (Legendary+Mythical)${skipped ? `, skipped ${skipped} incomplete rows` : ''}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
