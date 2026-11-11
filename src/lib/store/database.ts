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
  CREATE TABLE IF NOT EXISTS draft_items (
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    PRIMARY KEY (source, external_id)
  );
  CREATE TABLE IF NOT EXISTS work_details (
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    started_at TEXT,
    points REAL,
    story_type TEXT,
    additions INTEGER,
    deletions INTEGER,
    changed_files INTEGER,
    PRIMARY KEY (source, external_id)
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    story_type TEXT,
    state TEXT NOT NULL,
    estimate REAL
  );
  CREATE TABLE IF NOT EXISTS ticket_pull_requests (
    ticket_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    is_draft INTEGER NOT NULL,
    is_merged INTEGER NOT NULL,
    PRIMARY KEY (ticket_id, url)
  );
  CREATE TABLE IF NOT EXISTS ticket_roles (
    ticket_id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS ticket_owners (
    ticket_id TEXT NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (ticket_id, name)
  );
  CREATE TABLE IF NOT EXISTS assigned_stories (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    completed_at TEXT,
    story_type TEXT,
    estimate REAL,
    state TEXT NOT NULL,
    state_type TEXT,
    state_position INTEGER
  );
  CREATE TABLE IF NOT EXISTS pull_request_reviews (
    url TEXT PRIMARY KEY,
    status TEXT NOT NULL
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
