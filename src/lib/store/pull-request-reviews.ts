import type { DatabaseSync } from "node:sqlite";

export type ReviewStatus = "awaiting_review" | "in_review" | "changes_requested" | "approved";

export type PullRequestReview = { url: string; status: ReviewStatus };

const DELETE_ALL = `DELETE FROM pull_request_reviews`;

const INSERT = `INSERT INTO pull_request_reviews (url, status) VALUES (?, ?)`;

export function reviewStatusJoin(table: string): string {
  return `LEFT JOIN pull_request_reviews ON pull_request_reviews.url = ${table}.url`;
}

export function toReviewStatus(value: string | null): ReviewStatus | null {
  return value as ReviewStatus | null;
}

export function replacePullRequestReviews(db: DatabaseSync, reviews: PullRequestReview[]): void {
  db.prepare(DELETE_ALL).run();
  const statement = db.prepare(INSERT);
  for (const review of reviews) statement.run(review.url, review.status);
}
