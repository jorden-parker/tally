import type { DatabaseSync } from "node:sqlite";
import type { WeekStart } from "@/lib/metrics/buckets";

export type Settings = {
  allowList: string[];
  weekStart: WeekStart;
  timeZone: string;
  lastSyncedAt: string | null;
};

export type Snapshots = {
  openAuthoredPrs?: number;
  reviewRequestedPrs?: number;
  storiesInProgress?: number;
};

export const DEFAULT_SETTINGS: Settings = {
  allowList: [],
  weekStart: 1,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  lastSyncedAt: null,
};

function parseStored(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function loadSettings(db: DatabaseSync): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const stored = Object.fromEntries(
    rows.flatMap(({ key, value }) => {
      const parsed = parseStored(value);
      return parsed === undefined ? [] : [[key, parsed]];
    }),
  );
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(db: DatabaseSync, changes: Partial<Settings>): void {
  const statement = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
  );
  for (const [key, value] of Object.entries(changes)) {
    statement.run(key, JSON.stringify(value));
  }
}

export function recordSnapshots(db: DatabaseSync, snapshots: Snapshots, takenAt: string): void {
  const statement = db.prepare(
    "INSERT INTO snapshots (key, value, taken_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, taken_at = excluded.taken_at",
  );
  for (const [key, value] of Object.entries(snapshots)) {
    statement.run(key, value, takenAt);
  }
}

export function loadSnapshots(db: DatabaseSync): Snapshots {
  const rows = db.prepare("SELECT key, value FROM snapshots").all() as {
    key: string;
    value: number;
  }[];
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}
