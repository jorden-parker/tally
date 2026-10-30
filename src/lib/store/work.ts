import type { DatabaseSync } from "node:sqlite";
import { toEvent, type EventRow, type TallyEvent } from "./events";

export type WorkDetails = {
  startedAt: string | null;
  points: number | null;
  storyType: string | null;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
};

export type WorkItem = TallyEvent & WorkDetails;

type WorkRow = EventRow & {
  started_at: string | null;
  points: number | null;
  story_type: string | null;
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
};

const UPSERT = `
  INSERT INTO work_details
    (source, external_id, started_at, points, story_type, additions, deletions, changed_files)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (source, external_id) DO UPDATE SET
    started_at = excluded.started_at,
    points = excluded.points,
    story_type = excluded.story_type,
    additions = excluded.additions,
    deletions = excluded.deletions,
    changed_files = excluded.changed_files
`;

const COMPLETED_BETWEEN = `
  SELECT
    events.source, kind, events.external_id, occurred_at, repo, title, url,
    started_at, points, story_type, additions, deletions, changed_files
  FROM events
  LEFT JOIN work_details USING (source, external_id)
  WHERE kind IN ('pr_merged', 'story_completed') AND occurred_at >= ? AND occurred_at < ?
  ORDER BY occurred_at DESC, events.external_id ASC
`;

function toWorkItem(row: WorkRow): WorkItem {
  return {
    ...toEvent(row),
    startedAt: row.started_at,
    points: row.points,
    storyType: row.story_type,
    additions: row.additions,
    deletions: row.deletions,
    changedFiles: row.changed_files,
  };
}

export function upsertWorkDetails(db: DatabaseSync, items: WorkItem[]): void {
  const statement = db.prepare(UPSERT);
  for (const item of items) {
    statement.run(
      item.source,
      item.externalId,
      item.startedAt,
      item.points,
      item.storyType,
      item.additions,
      item.deletions,
      item.changedFiles,
    );
  }
}

export function completedWork(db: DatabaseSync, from: string, to: string): WorkItem[] {
  const rows = db.prepare(COMPLETED_BETWEEN).all(from, to) as WorkRow[];
  return rows.map(toWorkItem);
}
