import type { DatabaseSync } from "node:sqlite";

export type EventSource = "github" | "shortcut";

export type EventKind = "pr_reviewed" | "pr_created" | "pr_merged" | "story_completed";

export type TallyEvent = {
  source: EventSource;
  kind: EventKind;
  externalId: string;
  occurredAt: string;
  repo: string | null;
  title: string;
  url: string;
};

export type EventRow = {
  source: EventSource;
  kind: EventKind;
  external_id: string;
  occurred_at: string;
  repo: string | null;
  title: string;
  url: string;
};

const UPSERT = `
  INSERT INTO events (source, kind, external_id, occurred_at, repo, title, url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (source, kind, external_id) DO UPDATE SET
    occurred_at = excluded.occurred_at,
    repo = excluded.repo,
    title = excluded.title,
    url = excluded.url
`;

const BETWEEN = `
  SELECT source, kind, external_id, occurred_at, repo, title, url
  FROM events
  WHERE occurred_at >= ? AND occurred_at < ?
  ORDER BY occurred_at ASC, external_id ASC
`;

export function toEvent(row: EventRow): TallyEvent {
  return {
    source: row.source,
    kind: row.kind,
    externalId: row.external_id,
    occurredAt: row.occurred_at,
    repo: row.repo,
    title: row.title,
    url: row.url,
  };
}

export function upsertEvents(db: DatabaseSync, events: TallyEvent[]): void {
  const statement = db.prepare(UPSERT);
  for (const event of events) {
    statement.run(
      event.source,
      event.kind,
      event.externalId,
      event.occurredAt,
      event.repo,
      event.title,
      event.url,
    );
  }
}

export function eventsBetween(db: DatabaseSync, from: string, to: string): TallyEvent[] {
  const rows = db.prepare(BETWEEN).all(from, to) as EventRow[];
  return rows.map(toEvent);
}
