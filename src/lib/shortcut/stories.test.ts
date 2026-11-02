import { describe, expect, it } from "vitest";
import type { ShortcutGet } from "./client";
import {
  countInProgressStories,
  fetchAssignedStories,
  fetchCompletedStories,
  fetchMentionName,
  fetchWorkflowStateNames,
} from "./stories";

function story(id: number, completedAt: string | null) {
  return {
    id,
    name: `Story ${id}`,
    app_url: `https://app.shortcut.com/acme/story/${id}`,
    completed_at: completedAt,
    created_at: "2026-10-01T09:00:00Z",
    workflow_state_id: 500,
  };
}

const STATE_NAMES = new Map([[500, "In Progress"]]);

function queryOf(path: string): string | null {
  return new URL(path, "https://api.app.shortcut.com").searchParams.get("query");
}

describe("fetchMentionName", () => {
  it("reads the mention name of the token's member", async () => {
    const get: ShortcutGet = async <T>() => ({ mention_name: "jorden" }) as T;

    expect(await fetchMentionName(get)).toBe("jorden");
  });
});

describe("fetchCompletedStories", () => {
  it("keeps the estimate, type and start time, and nulls whatever Shortcut omits", async () => {
    const get: ShortcutGet = async <T>() =>
      ({
        data: [
          {
            ...story(1, "2026-10-29T09:00:00Z"),
            estimate: 3,
            story_type: "bug",
            started_at: "2026-10-26T09:00:00Z",
          },
          story(2, "2026-10-29T10:00:00Z"),
        ],
        next: null,
      }) as T;

    const [estimated, bare] = await fetchCompletedStories(get, "jorden", window);

    expect(estimated).toMatchObject({
      points: 3,
      storyType: "bug",
      startedAt: "2026-10-26T09:00:00Z",
      additions: null,
      deletions: null,
      changedFiles: null,
    });
    expect(bare).toMatchObject({ points: null, startedAt: null });
  });

  const window = { fromDay: "2026-09-01", toDay: "2026-10-31" };

  it("searches my done stories in the window and maps them to events", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return { data: [story(11, "2026-10-28T09:00:00Z")], next: null, total: 1 } as T;
    };

    const events = await fetchCompletedStories(get, "jorden", window);

    expect(queryOf(paths[0])).toBe("owner:jorden is:done completed:2026-09-01..2026-10-31");
    expect(events).toEqual([
      {
        source: "shortcut",
        kind: "story_completed",
        externalId: "11",
        occurredAt: "2026-10-28T09:00:00Z",
        repo: null,
        title: "Story 11",
        url: "https://app.shortcut.com/acme/story/11",
        startedAt: null,
        points: null,
        storyType: null,
        additions: null,
        deletions: null,
        changedFiles: null,
      },
    ]);
  });

  it("follows the next link and skips stories without a completion time", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return (
        paths.length === 1
          ? { data: [story(1, "2026-10-01T09:00:00Z")], next: "/api/v3/search/stories?next=abc" }
          : { data: [story(2, null), story(3, "2026-10-02T09:00:00Z")], next: null }
      ) as T;
    };

    const events = await fetchCompletedStories(get, "jorden", window);

    expect(paths[1]).toBe("/api/v3/search/stories?next=abc");
    expect(events.map((event) => event.externalId)).toEqual(["1", "3"]);
  });
});

describe("countInProgressStories", () => {
  it("returns the total of my started, unfinished stories", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return { data: [], next: null, total: 4 } as T;
    };

    expect(await countInProgressStories(get, "jorden")).toBe(4);
    expect(queryOf(paths[0])).toBe("owner:jorden is:started !is:done");
  });
});

describe("fetchWorkflowStateNames", () => {
  it("maps every state id across every workflow to its name", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return [
        {
          states: [
            { id: 500, name: "In Progress" },
            { id: 501, name: "Done" },
          ],
        },
        { states: [{ id: 600, name: "Backlog" }] },
      ] as T;
    };

    const names = await fetchWorkflowStateNames(get);

    expect(paths).toEqual(["/api/v3/workflows"]);
    expect(names).toEqual(
      new Map([
        [500, "In Progress"],
        [501, "Done"],
        [600, "Backlog"],
      ]),
    );
  });
});

describe("fetchAssignedStories", () => {
  it("searches my unfinished, unarchived stories and maps them to tickets", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return {
        data: [
          {
            ...story(31, null),
            story_type: "bug",
            estimate: 2,
            pull_requests: [
              {
                url: "https://github.com/acme/api/pull/9",
                title: "Fix retries",
                draft: true,
                merged: false,
                closed: false,
              },
              {
                url: "https://github.com/acme/api/pull/8",
                title: "Ship retries",
                draft: false,
                merged: true,
                closed: true,
              },
              {
                url: "https://github.com/acme/api/pull/7",
                title: "Abandoned",
                draft: false,
                merged: false,
                closed: true,
              },
            ],
          },
        ],
        next: null,
      } as T;
    };

    const tickets = await fetchAssignedStories(get, "jorden", STATE_NAMES);

    expect(queryOf(paths[0])).toBe("owner:jorden !is:done !is:archived");
    expect(tickets).toEqual([
      {
        id: "31",
        title: "Story 31",
        url: "https://app.shortcut.com/acme/story/31",
        openedAt: "2026-10-01T09:00:00Z",
        storyType: "bug",
        state: "In Progress",
        estimate: 2,
        pullRequests: [
          {
            url: "https://github.com/acme/api/pull/9",
            title: "Fix retries",
            isDraft: true,
            isMerged: false,
          },
          {
            url: "https://github.com/acme/api/pull/8",
            title: "Ship retries",
            isDraft: false,
            isMerged: true,
          },
        ],
      },
    ]);
  });

  it("nulls what Shortcut omits and names an unknown state", async () => {
    const get: ShortcutGet = async <T>() =>
      ({ data: [{ ...story(31, null), workflow_state_id: 999 }], next: null }) as T;

    const [ticket] = await fetchAssignedStories(get, "jorden", STATE_NAMES);

    expect(ticket).toMatchObject({
      storyType: null,
      estimate: null,
      state: "Unknown",
      pullRequests: [],
    });
  });

  it("follows the next link so stories past the first page are included", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return (
        paths.length === 1
          ? { data: [story(1, null)], next: "/api/v3/search/stories?next=abc" }
          : { data: [story(2, null)], next: null }
      ) as T;
    };

    const tickets = await fetchAssignedStories(get, "jorden", STATE_NAMES);

    expect(paths[1]).toBe("/api/v3/search/stories?next=abc");
    expect(tickets.map((ticket) => ticket.id)).toEqual(["1", "2"]);
  });
});
