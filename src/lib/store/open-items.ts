import type { DatabaseSync } from "node:sqlite";
import type { EventSource } from "@/lib/store/events";

export type OpenItem = {
  source: EventSource;
  externalId: string;
  openedAt: string;
  repo: string | null;
  title: string;
  url: string;
};

type OpenItemRow = {
  source: EventSource;
  external_id: string;
  opened_at: string;
  repo: string | null;
  title: string;
  url: string;
};

const DELETE_SOURCE = `DELETE FROM open_items WHERE source = ?`;

const INSERT = `
  INSERT INTO open_items (source, external_id, opened_at, repo, title, url)
  VALUES (?, ?, ?, ?, ?, ?)
`;

const ALL = `
  SELECT source, external_id, opened_at, repo, title, url
  FROM open_items
  ORDER BY opened_at DESC, external_id ASC
`;

function toOpenItem(row: OpenItemRow): OpenItem {
  return {
    source: row.source,
    externalId: row.external_id,
    openedAt: row.opened_at,
    repo: row.repo,
    title: row.title,
    url: row.url,
  };
}

export function replaceOpenItems(db: DatabaseSync, source: EventSource, items: OpenItem[]): void {
  db.prepare(DELETE_SOURCE).run(source);
  const statement = db.prepare(INSERT);
  for (const item of items) {
    statement.run(item.source, item.externalId, item.openedAt, item.repo, item.title, item.url);
  }
}

export function loadOpenItems(db: DatabaseSync): OpenItem[] {
  const rows = db.prepare(ALL).all() as OpenItemRow[];
  return rows.map(toOpenItem);
}
