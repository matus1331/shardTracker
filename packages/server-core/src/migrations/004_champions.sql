CREATE TABLE IF NOT EXISTS champions (
  hero_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  shortname TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('LEGENDARY', 'MYTHICAL')),
  affinity TEXT,
  faction TEXT,
  hellhades_url TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_champions_name ON champions (name);
CREATE INDEX IF NOT EXISTS idx_champions_rarity ON champions (rarity);
