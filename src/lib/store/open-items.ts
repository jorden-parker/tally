import type { DatabaseSync } from "node:sqlite";
import type { EventSource } from "@/lib/store/events";
import { reviewStatusJoin, toReviewStatus, type ReviewStatus } from "./pull-request-reviews";

export type OpenItem = {
  source: EventSource;
  externalId: string;
  openedAt: string;
  isDraft: boolean;
  repo: string | null;
  title: string;
  url: string;
  reviewStatus: ReviewStatus | null;
};

type OpenItemRow = {
  source: EventSource;
  external_id: string;
  opened_at: string;
  is_draft: number;
  repo: string | null;
  title: string;
  url: string;
  review_status: string | null;
};

const DELETE_SOURCE = `DELETE FROM open_items WHERE source = ?`;

const DELETE_SOURCE_DRAFTS = `DELETE FROM draft_items WHERE source = ?`;

const INSERT = `
  INSERT INTO open_items (source, external_id, opened_at, repo, title, url)
  VALUES (?, ?, ?, ?, ?, ?)
`;

const INSERT_DRAFT = `INSERT INTO draft_items (source, external_id) VALUES (?, ?)`;

const ALL = `
  SELECT
    open_items.source, open_items.external_id, opened_at, repo, title, open_items.url,
    draft_items.external_id IS NOT NULL AS is_draft,
    pull_request_reviews.status AS review_status
  FROM open_items
  LEFT JOIN draft_items USING (source, external_id)
  ${reviewStatusJoin("open_items")}
  ORDER BY opened_at DESC, open_items.external_id ASC
`;

function toOpenItem(row: OpenItemRow): OpenItem {
  return {
    source: row.source,
    externalId: row.external_id,
    openedAt: row.opened_at,
    isDraft: row.is_draft === 1,
    repo: row.repo,
    title: row.title,
    url: row.url,
    reviewStatus: toReviewStatus(row.review_status),
  };
}

export function replaceOpenItems(db: DatabaseSync, source: EventSource, items: OpenItem[]): void {
  db.prepare(DELETE_SOURCE).run(source);
  db.prepare(DELETE_SOURCE_DRAFTS).run(source);
  const statement = db.prepare(INSERT);
  const draftStatement = db.prepare(INSERT_DRAFT);
  for (const item of items) {
    statement.run(item.source, item.externalId, item.openedAt, item.repo, item.title, item.url);
    if (item.isDraft) draftStatement.run(item.source, item.externalId);
  }
}

export function loadOpenItems(db: DatabaseSync): OpenItem[] {
  const rows = db.prepare(ALL).all() as OpenItemRow[];
  return rows.map(toOpenItem);
}
