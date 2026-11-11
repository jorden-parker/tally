import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  loadAssignedStories,
  replaceAssignedStories,
  type AssignedStory,
} from "./assigned-stories";
import { openDatabase } from "./database";

function assignedStory(overrides: Partial<AssignedStory> = {}): AssignedStory {
  return {
    id: "31",
    title: "Plan the rollout",
    url: "https://app.shortcut.com/acme/story/31",
    openedAt: "2026-10-10T09:00:00Z",
    completedAt: null,
    storyType: "feature",
    estimate: 3,
    state: "In Progress",
    stateType: "started",
    statePosition: 2,
    ...overrides,
  };
}

describe("assigned stories store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("round-trips stories, keeping nulls, newest first", () => {
    const older = assignedStory({ id: "12", openedAt: "2026-09-01T09:00:00Z" });
    const unknown = assignedStory({
      id: "44",
      storyType: null,
      estimate: null,
      state: "Unknown",
      stateType: null,
      statePosition: null,
      completedAt: "2026-10-20T09:00:00Z",
    });

    replaceAssignedStories(db, [older, unknown]);

    expect(loadAssignedStories(db)).toEqual([unknown, older]);
  });

  it("replaces the previous stories on each call", () => {
    replaceAssignedStories(db, [assignedStory({ id: "1" }), assignedStory({ id: "2" })]);
    replaceAssignedStories(db, [assignedStory({ id: "3" })]);

    expect(loadAssignedStories(db).map((story) => story.id)).toEqual(["3"]);
  });
});
