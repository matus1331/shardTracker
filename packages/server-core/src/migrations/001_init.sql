CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shard_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  shard_type TEXT NOT NULL CHECK (shard_type IN ('ANCIENT', 'VOID', 'PRIMAL', 'SACRED', 'REMNANT')),
  since_last_drop INTEGER NOT NULL DEFAULT 0,
  lifetime_opened INTEGER NOT NULL DEFAULT 0,
  lifetime_drops INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, shard_type)
);

CREATE TABLE IF NOT EXISTS shard_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  shard_type TEXT NOT NULL CHECK (shard_type IN ('ANCIENT', 'VOID', 'PRIMAL', 'SACRED', 'REMNANT')),
  action_type TEXT NOT NULL CHECK (action_type IN ('ADD', 'CORRECTION')),
  amount INTEGER,
  got_drop INTEGER NOT NULL DEFAULT 0,
  since_last_drop_before INTEGER NOT NULL,
  since_last_drop_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
