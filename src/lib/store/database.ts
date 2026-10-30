import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const IN_MEMORY = ":memory:";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    external_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    repo TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (source, kind, external_id)
  );
  CREATE INDEX IF NOT EXISTS events_occurred_at ON events (occurred_at);
  CREATE TABLE IF NOT EXISTS open_items (
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    repo TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (source, external_id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL,
    taken_at TEXT NOT NULL
  );
`;

export function openDatabase(location: string): DatabaseSync {
  const db = new DatabaseSync(location);
  db.exec(SCHEMA);
  if (location !== IN_MEMORY) {
    fs.chmodSync(location, 0o600);
  }
  return db;
}
