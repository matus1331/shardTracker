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
