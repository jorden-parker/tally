import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import { eventsBetween, upsertEvents, type TallyEvent } from "./events";

function reviewed(overrides: Partial<TallyEvent> = {}): TallyEvent {
  return {
    source: "github",
    kind: "pr_reviewed",
    externalId: "review-1",
    occurredAt: "2026-10-28T10:00:00Z",
    repo: "acme/api",
    title: "Add retries",
    url: "https://github.com/acme/api/pull/1",
    ...overrides,
  };
}

describe("events store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("returns stored events inside the range, oldest first", () => {
    upsertEvents(db, [
      reviewed({ externalId: "late", occurredAt: "2026-10-30T10:00:00Z" }),
      reviewed({ externalId: "early", occurredAt: "2026-10-27T10:00:00Z" }),
      reviewed({ externalId: "outside", occurredAt: "2026-09-01T10:00:00Z" }),
    ]);

    const found = eventsBetween(db, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");

    expect(found.map((event) => event.externalId)).toEqual(["early", "late"]);
  });

  it("round-trips every field", () => {
    const event = reviewed({ repo: null });
    upsertEvents(db, [event]);

    expect(eventsBetween(db, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")).toEqual([event]);
  });

  it("is idempotent and refreshes a changed title", () => {
    upsertEvents(db, [reviewed()]);
    upsertEvents(db, [reviewed({ title: "Add retries (renamed)" })]);

    const found = eventsBetween(db, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");

    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("Add retries (renamed)");
  });

  it("keeps the same external id apart across kinds", () => {
    upsertEvents(db, [reviewed(), reviewed({ kind: "pr_created" })]);

    expect(eventsBetween(db, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")).toHaveLength(2);
  });

  it("accepts an empty batch", () => {
    upsertEvents(db, []);

    expect(eventsBetween(db, "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")).toEqual([]);
  });
});
