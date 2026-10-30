import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import { loadOpenItems, replaceOpenItems, type OpenItem } from "./open-items";

function pullRequest(overrides: Partial<OpenItem> = {}): OpenItem {
  return {
    source: "github",
    externalId: "https://github.com/acme/api/pull/1",
    openedAt: "2026-10-20T10:00:00Z",
    isDraft: false,
    repo: "acme/api",
    title: "Add retries",
    url: "https://github.com/acme/api/pull/1",
    ...overrides,
  };
}

function story(overrides: Partial<OpenItem> = {}): OpenItem {
  return {
    source: "shortcut",
    externalId: "31",
    openedAt: "2026-10-10T09:00:00Z",
    isDraft: false,
    repo: null,
    title: "Plan the rollout",
    url: "https://app.shortcut.com/acme/story/31",
    ...overrides,
  };
}

describe("open items store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("round-trips every field, including a null repo", () => {
    const item = story();
    replaceOpenItems(db, "shortcut", [item]);

    expect(loadOpenItems(db)).toEqual([item]);
  });

  it("returns items newest first by openedAt", () => {
    replaceOpenItems(db, "github", [
      pullRequest({ externalId: "old", openedAt: "2026-10-01T10:00:00Z" }),
      pullRequest({ externalId: "new", openedAt: "2026-10-25T10:00:00Z" }),
    ]);

    expect(loadOpenItems(db).map((item) => item.externalId)).toEqual(["new", "old"]);
  });

  it("drops a source's old items when it is replaced, so a closed PR disappears", () => {
    replaceOpenItems(db, "github", [pullRequest({ externalId: "closed" })]);
    replaceOpenItems(db, "github", [pullRequest({ externalId: "still-open", url: "x" })]);

    expect(loadOpenItems(db).map((item) => item.externalId)).toEqual(["still-open"]);
  });

  it("leaves the other source's items alone", () => {
    replaceOpenItems(db, "shortcut", [story()]);
    replaceOpenItems(db, "github", [pullRequest()]);
    replaceOpenItems(db, "github", []);

    expect(loadOpenItems(db)).toEqual([story()]);
  });

  it("round-trips a draft PR", () => {
    const draft = pullRequest({ isDraft: true });
    replaceOpenItems(db, "github", [draft]);

    expect(loadOpenItems(db)).toEqual([draft]);
  });

  it("clears the draft flag once a PR is marked ready for review", () => {
    replaceOpenItems(db, "github", [pullRequest({ isDraft: true })]);
    replaceOpenItems(db, "github", [pullRequest()]);

    expect(loadOpenItems(db).map((item) => item.isDraft)).toEqual([false]);
  });

  it("keeps GitHub drafts when Shortcut items are replaced", () => {
    replaceOpenItems(db, "github", [pullRequest({ isDraft: true })]);
    replaceOpenItems(db, "shortcut", []);

    expect(loadOpenItems(db).map((item) => item.isDraft)).toEqual([true]);
  });

  it("clears a source when replaced with an empty list", () => {
    replaceOpenItems(db, "shortcut", [story()]);
    replaceOpenItems(db, "shortcut", []);

    expect(loadOpenItems(db)).toEqual([]);
  });
});
