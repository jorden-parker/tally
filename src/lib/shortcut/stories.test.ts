import { describe, expect, it } from "vitest";
import type { ShortcutGet } from "./client";
import {
  countInProgressStories,
  fetchAssignedStories,
  fetchCompletedStories,
  fetchMemberNames,
  fetchMentionName,
  fetchStoriesById,
  fetchWorkflowStateNames,
  toTicket,
  toWorkItem,
  type StoryContext,
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

const CONTEXT: StoryContext = {
  stateNames: new Map([[500, "In Progress"]]),
  memberNames: new Map([
    ["m-1", "Ada"],
    ["m-2", "Grace"],
  ]),
};

function queryOf(path: string): string | null {
  return new URL(path, "https://api.app.shortcut.com").searchParams.get("query");
}

describe("fetchMentionName", () => {
  it("reads the mention name of the token's member", async () => {
    const get: ShortcutGet = async <T>() => ({ mention_name: "jorden" }) as T;

    expect(await fetchMentionName(get)).toBe("jorden");
  });
});

describe("fetchMemberNames", () => {
  it("maps member ids to display names", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return [
        { id: "m-1", profile: { name: "Ada" } },
        { id: "m-2", profile: { name: "Grace" } },
      ] as T;
    };

    expect(await fetchMemberNames(get)).toEqual(CONTEXT.memberNames);
    expect(paths).toEqual(["/api/v3/members"]);
  });
});

describe("toWorkItem", () => {
  it("keeps the estimate, type and start time, and nulls whatever Shortcut omits", () => {
    const estimated = toWorkItem({
      ...story(1, "2026-10-29T09:00:00Z"),
      completed_at: "2026-10-29T09:00:00Z",
      estimate: 3,
      story_type: "bug",
      started_at: "2026-10-26T09:00:00Z",
    });
    const bare = toWorkItem({ ...story(2, null), completed_at: "2026-10-29T10:00:00Z" });

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

  it("maps a completed story to an event", () => {
    expect(toWorkItem({ ...story(11, null), completed_at: "2026-10-28T09:00:00Z" })).toEqual({
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
    });
  });
});

describe("toTicket", () => {
  it("names the owners, keeps the role and completion time, and drops closed unmerged PRs", () => {
    const ticket = toTicket(
      {
        ...story(31, "2026-10-29T09:00:00Z"),
        story_type: "bug",
        estimate: 2,
        owner_ids: ["m-2", "m-1", "m-unknown"],
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
      "completed",
      CONTEXT,
    );

    expect(ticket).toEqual({
      id: "31",
      title: "Story 31",
      url: "https://app.shortcut.com/acme/story/31",
      openedAt: "2026-10-01T09:00:00Z",
      storyType: "bug",
      state: "In Progress",
      estimate: 2,
      role: "completed",
      completedAt: "2026-10-29T09:00:00Z",
      owners: ["Grace", "Ada"],
      pullRequests: [
        {
          url: "https://github.com/acme/api/pull/9",
          title: "Fix retries",
          isDraft: true,
          isMerged: false,
          reviewStatus: null,
        },
        {
          url: "https://github.com/acme/api/pull/8",
          title: "Ship retries",
          isDraft: false,
          isMerged: true,
          reviewStatus: null,
        },
      ],
    });
  });

  it("nulls what Shortcut omits and names an unknown state", () => {
    const ticket = toTicket({ ...story(31, null), workflow_state_id: 999 }, "assigned", CONTEXT);

    expect(ticket).toMatchObject({
      storyType: null,
      estimate: null,
      state: "Unknown",
      completedAt: null,
      owners: [],
      pullRequests: [],
    });
  });
});

describe("fetchCompletedStories", () => {
  const window = { fromDay: "2026-09-01", toDay: "2026-10-31" };

  it("searches my done stories in the window", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return { data: [story(11, "2026-10-28T09:00:00Z")], next: null, total: 1 } as T;
    };

    const stories = await fetchCompletedStories(get, "jorden", window);

    expect(queryOf(paths[0])).toBe("owner:jorden is:done completed:2026-09-01..2026-10-31");
    expect(stories.map((item) => item.id)).toEqual([11]);
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

    const stories = await fetchCompletedStories(get, "jorden", window);

    expect(paths[1]).toBe("/api/v3/search/stories?next=abc");
    expect(stories.map((item) => item.id)).toEqual([1, 3]);
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
  it("searches my unfinished, unarchived stories and maps them to assigned tickets", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return { data: [{ ...story(31, null), owner_ids: ["m-1"] }], next: null } as T;
    };

    const tickets = await fetchAssignedStories(get, "jorden", CONTEXT);

    expect(queryOf(paths[0])).toBe("owner:jorden !is:done !is:archived");
    expect(tickets).toEqual([
      {
        id: "31",
        title: "Story 31",
        url: "https://app.shortcut.com/acme/story/31",
        openedAt: "2026-10-01T09:00:00Z",
        storyType: null,
        state: "In Progress",
        estimate: null,
        role: "assigned",
        completedAt: null,
        owners: ["Ada"],
        pullRequests: [],
      },
    ]);
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

    const tickets = await fetchAssignedStories(get, "jorden", CONTEXT);

    expect(paths[1]).toBe("/api/v3/search/stories?next=abc");
    expect(tickets.map((ticket) => ticket.id)).toEqual(["1", "2"]);
  });
});

describe("fetchStoriesById", () => {
  it("fetches each story and maps it to a reviewing ticket", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      const id = Number(path.split("/").at(-1));
      return { ...story(id, null), owner_ids: ["m-2"] } as T;
    };

    const tickets = await fetchStoriesById(get, ["12", "34"], CONTEXT);

    expect(paths).toEqual(["/api/v3/stories/12", "/api/v3/stories/34"]);
    expect(tickets.map((ticket) => [ticket.id, ticket.role, ticket.owners])).toEqual([
      ["12", "reviewing", ["Grace"]],
      ["34", "reviewing", ["Grace"]],
    ]);
  });

  it("skips ids Shortcut cannot find", async () => {
    const get: ShortcutGet = async <T>(path: string) => {
      if (path.endsWith("/404")) throw new Error("not found");
      return story(12, null) as T;
    };

    const tickets = await fetchStoriesById(get, ["12", "404"], CONTEXT);

    expect(tickets.map((ticket) => ticket.id)).toEqual(["12"]);
  });

  it("asks nothing when there are no ids", async () => {
    const get: ShortcutGet = async () => {
      throw new Error("must not be called");
    };

    expect(await fetchStoriesById(get, [], CONTEXT)).toEqual([]);
  });
});
