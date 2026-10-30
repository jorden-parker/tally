import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import { upsertEvents, type TallyEvent } from "./events";
import { completedWork, upsertWorkDetails, type WorkItem } from "./work";

const WINDOW = ["2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"] as const;

function mergedPr(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    source: "github",
    kind: "pr_merged",
    externalId: "https://github.com/acme/api/pull/4",
    occurredAt: "2026-10-27T16:00:00Z",
    repo: "acme/api",
    title: "Ship it",
    url: "https://github.com/acme/api/pull/4",
    startedAt: "2026-10-25T16:00:00Z",
    points: null,
    storyType: null,
    additions: 120,
    deletions: 30,
    changedFiles: 4,
    ...overrides,
  };
}

function completedStory(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    source: "shortcut",
    kind: "story_completed",
    externalId: "21",
    occurredAt: "2026-10-29T09:00:00Z",
    repo: null,
    title: "Ship tally",
    url: "https://app.shortcut.com/acme/story/21",
    startedAt: "2026-10-26T09:00:00Z",
    points: 3,
    storyType: "feature",
    additions: null,
    deletions: null,
    changedFiles: null,
    ...overrides,
  };
}

function bareEvent(overrides: Partial<TallyEvent> = {}): TallyEvent {
  return {
    source: "github",
    kind: "pr_merged",
    externalId: "https://github.com/acme/api/pull/1",
    occurredAt: "2026-10-05T10:00:00Z",
    repo: "acme/api",
    title: "Old merge",
    url: "https://github.com/acme/api/pull/1",
    ...overrides,
  };
}

describe("work store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  function store(...items: WorkItem[]) {
    upsertEvents(db, items);
    upsertWorkDetails(db, items);
  }

  it("returns merged PRs and completed stories with their details, newest first", () => {
    store(mergedPr(), completedStory());

    expect(completedWork(db, ...WINDOW)).toEqual([completedStory(), mergedPr()]);
  });

  it("leaves other event kinds out", () => {
    upsertEvents(db, [bareEvent({ kind: "pr_created" }), bareEvent({ kind: "pr_reviewed" })]);

    expect(completedWork(db, ...WINDOW)).toEqual([]);
  });

  it("returns null details for events synced before details were stored", () => {
    upsertEvents(db, [bareEvent()]);

    expect(completedWork(db, ...WINDOW)).toEqual([
      {
        ...bareEvent(),
        startedAt: null,
        points: null,
        storyType: null,
        additions: null,
        deletions: null,
        changedFiles: null,
      },
    ]);
  });

  it("includes the start of the window and excludes the end", () => {
    store(
      mergedPr({ externalId: "at-start", occurredAt: WINDOW[0] }),
      mergedPr({ externalId: "at-end", occurredAt: WINDOW[1] }),
    );

    expect(completedWork(db, ...WINDOW).map((item) => item.externalId)).toEqual(["at-start"]);
  });

  it("updates details when the same work is synced again", () => {
    store(mergedPr());
    store(mergedPr({ additions: 200 }));

    expect(completedWork(db, ...WINDOW).map((item) => item.additions)).toEqual([200]);
  });
});
