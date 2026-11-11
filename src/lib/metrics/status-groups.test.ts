import { describe, expect, it } from "vitest";
import type { AssignedStory } from "@/lib/store/assigned-stories";
import {
  ALL_STATUSES,
  filterByStatus,
  groupByStatus,
  filterForState,
  listStatusOptions,
  filterForType,
} from "./status-groups";

function assignedStory(
  id: string,
  state: string,
  stateType: AssignedStory["stateType"],
  statePosition: number | null,
): AssignedStory {
  return {
    id,
    title: `Story ${id}`,
    url: `https://app.shortcut.com/acme/story/${id}`,
    openedAt: "2026-10-10T09:00:00Z",
    completedAt: null,
    storyType: "feature",
    estimate: null,
    state,
    stateType,
    statePosition,
  };
}

const STORIES = [
  assignedStory("1", "Done", "done", 5),
  assignedStory("2", "In Progress", "started", 3),
  assignedStory("3", "Ready for Review", "started", 4),
  assignedStory("4", "Unknown", null, null),
  assignedStory("5", "In Progress", "started", 3),
  assignedStory("6", "Ready for Development", "unstarted", 2),
  assignedStory("7", "Icebox", "backlog", 1),
];

function idsOf(stories: AssignedStory[]): string[] {
  return stories.map((story) => story.id);
}

describe("listStatusOptions", () => {
  it("lists the states present under their Shortcut state type, in workflow order", () => {
    expect(listStatusOptions(STORIES)).toEqual([
      { type: "backlog", label: "Backlog", states: ["Icebox"] },
      { type: "unstarted", label: "Unstarted", states: ["Ready for Development"] },
      { type: "started", label: "Started", states: ["In Progress", "Ready for Review"] },
      { type: "done", label: "Done", states: ["Done"] },
      { type: null, label: "Other", states: ["Unknown"] },
    ]);
  });
});

describe("filterByStatus", () => {
  it("keeps everything for all statuses", () => {
    expect(idsOf(filterByStatus(STORIES, ALL_STATUSES))).toEqual(idsOf(STORIES));
  });

  it("keeps the stories of one state type", () => {
    expect(idsOf(filterByStatus(STORIES, filterForType("started")))).toEqual(["2", "3", "5"]);
  });

  it("keeps the stories in one workflow state", () => {
    expect(idsOf(filterByStatus(STORIES, filterForState("In Progress")))).toEqual(["2", "5"]);
  });
});

describe("groupByStatus", () => {
  it("groups by workflow state in workflow order, keeping story order within a group", () => {
    const groups = groupByStatus(STORIES, "state");

    expect(groups.map((group) => [group.label, idsOf(group.stories)])).toEqual([
      ["Icebox", ["7"]],
      ["Ready for Development", ["6"]],
      ["In Progress", ["2", "5"]],
      ["Ready for Review", ["3"]],
      ["Done", ["1"]],
      ["Unknown", ["4"]],
    ]);
  });

  it("groups by Shortcut state type", () => {
    const groups = groupByStatus(STORIES, "type");

    expect(groups.map((group) => [group.label, idsOf(group.stories)])).toEqual([
      ["Backlog", ["7"]],
      ["Unstarted", ["6"]],
      ["Started", ["2", "3", "5"]],
      ["Done", ["1"]],
      ["Other", ["4"]],
    ]);
  });

  it("puts everything in one group when not grouping", () => {
    const groups = groupByStatus(STORIES, "none");

    expect(groups.map((group) => [group.label, idsOf(group.stories)])).toEqual([
      ["All tickets", idsOf(STORIES)],
    ]);
  });

  it("returns no groups for no stories", () => {
    expect(groupByStatus([], "none")).toEqual([]);
  });
});
