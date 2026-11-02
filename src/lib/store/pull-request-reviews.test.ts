import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import { loadOpenItems, replaceOpenItems, type OpenItem } from "./open-items";
import { replacePullRequestReviews } from "./pull-request-reviews";

function pullRequest(url: string): OpenItem {
  return {
    source: "github",
    externalId: url,
    openedAt: "2026-10-20T10:00:00Z",
    isDraft: false,
    repo: "acme/api",
    title: "Add retries",
    url,
    reviewStatus: null,
  };
}

describe("pull request reviews store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("joins the review status onto open items by url", () => {
    replaceOpenItems(db, "github", [pullRequest("https://x/1"), pullRequest("https://x/2")]);
    replacePullRequestReviews(db, [{ url: "https://x/1", status: "approved" }]);

    expect(loadOpenItems(db).map((item) => [item.url, item.reviewStatus])).toEqual([
      ["https://x/1", "approved"],
      ["https://x/2", null],
    ]);
  });

  it("replaces every status on each call", () => {
    replaceOpenItems(db, "github", [pullRequest("https://x/1")]);
    replacePullRequestReviews(db, [{ url: "https://x/1", status: "awaiting_review" }]);
    replacePullRequestReviews(db, [{ url: "https://x/1", status: "in_review" }]);

    expect(loadOpenItems(db).map((item) => item.reviewStatus)).toEqual(["in_review"]);
  });

  it("forgets a status once the PR is no longer returned", () => {
    replaceOpenItems(db, "github", [pullRequest("https://x/1")]);
    replacePullRequestReviews(db, [{ url: "https://x/1", status: "approved" }]);
    replacePullRequestReviews(db, []);

    expect(loadOpenItems(db).map((item) => item.reviewStatus)).toEqual([null]);
  });
});
