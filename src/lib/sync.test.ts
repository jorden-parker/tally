import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { Runner } from "@/lib/exec";
import type { ShortcutGet } from "@/lib/shortcut/client";
import { openDatabase } from "@/lib/store/database";
import { eventsBetween } from "@/lib/store/events";
import { loadAssignedStories } from "@/lib/store/assigned-stories";
import { loadOpenItems } from "@/lib/store/open-items";
import { loadSettings, loadSnapshots, saveSettings } from "@/lib/store/settings";
import { loadTickets } from "@/lib/store/tickets";
import { completedWork } from "@/lib/store/work";
import { syncAll } from "./sync";

const NOW = new Date("2026-10-30T12:00:00Z");

function pullRequest(repo: string, number: number) {
  return {
    title: `PR ${number}`,
    url: `https://github.com/${repo}/pull/${number}`,
    repository: { nameWithOwner: repo },
  };
}

function searchPage(nodes: unknown[]): string {
  return JSON.stringify({
    data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
  });
}

function reviewSearchPage(): string {
  const reviewed = (repo: string, number: number, reviewUrl: string) => ({
    ...pullRequest(repo, number),
    reviews: { nodes: [{ url: reviewUrl, submittedAt: "2026-10-28T10:00:00Z" }] },
  });
  return searchPage([
    reviewed("acme/api", 1, "review-allowed"),
    reviewed("stranger/lib", 2, "review-blocked"),
  ]);
}

function mergedSearchPage(): string {
  const merged = (repo: string, number: number) => ({
    ...pullRequest(repo, number),
    createdAt: "2026-10-25T16:00:00Z",
    mergedAt: "2026-10-27T16:00:00Z",
    additions: 120,
    deletions: 30,
    changedFiles: 4,
  });
  return searchPage([merged("acme/api", 4), merged("stranger/lib", 8)]);
}

function openPullRequest(
  repo: string,
  number: number,
  createdAt: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    ...pullRequest(repo, number),
    createdAt,
    isDraft: false,
    headRefName: `branch-${number}`,
    author: { login: "jorden-parker" },
    reviewDecision: null,
    reviews: { totalCount: 0 },
    myReviews: { nodes: [] },
    ...overrides,
  };
}

const OPEN_AUTHORED = [
  openPullRequest("acme/api", 5, "2026-10-20T08:00:00Z", {
    reviewDecision: "APPROVED",
    reviews: { totalCount: 1 },
  }),
  openPullRequest("acme/web", 6, "2026-10-22T08:00:00Z", { isDraft: true }),
  openPullRequest("stranger/lib", 7, "2026-10-23T08:00:00Z", { isDraft: true }),
];

const TO_REVIEW = [
  openPullRequest("acme/api", 9, "2026-10-24T08:00:00Z", {
    headRefName: "ada/sc-77-retries",
    author: { login: "ada" },
  }),
  openPullRequest("stranger/lib", 10, "2026-10-25T08:00:00Z", {
    title: "Fix sc-31 flake",
    author: { login: "grace" },
    myReviews: { nodes: [{ state: "COMMENTED" }] },
  }),
];

function searchOf(args: string[]): string {
  return args.find((arg) => arg.startsWith("search="))?.slice("search=".length) ?? "";
}

function fakeGitHub(): { run: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const run: Runner = async (_command, args) => {
    calls.push(args);
    if (args[0] === "api" && args[1] === "user") return "jorden-parker\n";
    if (args.includes("--created")) {
      return JSON.stringify([{ ...pullRequest("acme/web", 3), createdAt: "2026-10-29T08:00:00Z" }]);
    }
    const search = searchOf(args);
    if (search.includes("is:merged")) return mergedSearchPage();
    if (search.includes("updated:")) return reviewSearchPage();
    if (search.includes("review-requested:")) return searchPage(TO_REVIEW);
    if (search.includes("reviewed-by:")) return searchPage([]);
    return searchPage(OPEN_AUTHORED);
  };
  return { run, calls };
}

function isOpenAuthoredSearch(args: string[]): boolean {
  return searchOf(args).startsWith("is:pr is:open author:");
}

function withOpenAuthoredPrs(openPrs: unknown[]): Runner {
  const { run } = fakeGitHub();
  return async (command, args) =>
    isOpenAuthoredSearch(args) ? searchPage(openPrs) : run(command, args);
}

function shortcutStory(id: number, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    app_url: `https://app.shortcut.com/acme/story/${id}`,
    completed_at: null,
    created_at: "2026-10-10T09:00:00Z",
    workflow_state_id: 500,
    story_type: "feature",
    estimate: 3,
    owner_ids: ["member-jorden"],
    ...overrides,
  };
}

const ASSIGNED_STORY = shortcutStory(31, "Plan the rollout", {
  pull_requests: [
    {
      url: "https://github.com/acme/api/pull/5",
      title: "Roll out",
      draft: true,
      merged: false,
      closed: false,
    },
    {
      url: "https://github.com/acme/api/pull/4",
      title: "Shipped",
      draft: false,
      merged: true,
      closed: true,
    },
    {
      url: "https://github.com/acme/api/pull/12",
      title: "Someone else's",
      draft: false,
      merged: false,
      closed: false,
    },
  ],
});

const COMPLETED_STORY = shortcutStory(21, "Ship tally", {
  completed_at: "2026-10-29T09:00:00Z",
  started_at: "2026-10-26T09:00:00Z",
});

const FINISHED_STORY = shortcutStory(41, "Old chore", {
  workflow_state_id: 501,
  completed_at: "2026-03-01T09:00:00Z",
});

const fakeShortcut: ShortcutGet = async <T>(path: string) => {
  if (path.endsWith("/member")) return { mention_name: "jorden" } as T;
  if (path.endsWith("/members")) {
    return [
      { id: "member-jorden", profile: { name: "Jorden" } },
      { id: "member-ada", profile: { name: "Ada" } },
    ] as T;
  }
  if (path.endsWith("/workflows")) {
    return [
      {
        states: [
          { id: 500, name: "In Progress", type: "started", position: 2 },
          { id: 501, name: "Done", type: "done", position: 3 },
        ],
      },
    ] as T;
  }
  if (path.includes("/stories/77")) {
    return shortcutStory(77, "Retry on timeout", { owner_ids: ["member-ada"] }) as T;
  }
  const query = new URL(path, "https://api.app.shortcut.com").searchParams.get("query") ?? "";
  if (query.includes("!is:archived")) {
    return { data: [ASSIGNED_STORY, FINISHED_STORY], next: null } as T;
  }
  if (query.includes("is:started")) return { data: [], next: null, total: 3 } as T;
  return { data: [COMPLETED_STORY], next: null } as T;
};

describe("syncAll", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
    saveSettings(db, { allowList: ["acme"] });
  });

  function storedEvents() {
    return eventsBetween(db, "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z");
  }

  function storedOpenPrUrls() {
    return loadOpenItems(db)
      .filter((item) => item.source === "github")
      .map((item) => item.externalId);
  }

  function ticketById(id: string) {
    return loadTickets(db).find((ticket) => ticket.id === id);
  }

  it("stores size and timing for allowed merged PRs and completed stories", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    const work = completedWork(db, "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z");
    expect(work.map((item) => [item.title, item.additions, item.points])).toEqual([
      ["Ship tally", null, 3],
      ["PR 4", 120, null],
    ]);
    expect(work.map((item) => item.startedAt)).toEqual([
      "2026-10-26T09:00:00Z",
      "2026-10-25T16:00:00Z",
    ]);
  });

  it("stores every story I own with its workflow state, finished ones included", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(
      loadAssignedStories(db).map((story) => [story.id, story.state, story.stateType]),
    ).toEqual([
      ["31", "In Progress", "started"],
      ["41", "Done", "done"],
    ]);
  });

  it("keeps finished stories off my open tickets", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(ticketById("41")).toBeUndefined();
    expect(ticketById("31")?.role).toBe("assigned");
  });

  it("stores which allowed open PRs are drafts", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    const drafts = loadOpenItems(db).filter((item) => item.isDraft);
    expect(drafts.map((item) => item.externalId)).toEqual(["https://github.com/acme/web/pull/6"]);
  });

  it("stores allowed events from both sources, the snapshots and the sync time", async () => {
    const { run } = fakeGitHub();

    const result = await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(result.errors).toEqual({});
    expect(storedEvents().map((event) => `${event.kind}:${event.externalId}`)).toEqual([
      "pr_merged:https://github.com/acme/api/pull/4",
      "pr_reviewed:review-allowed",
      "pr_created:https://github.com/acme/web/pull/3",
      "story_completed:21",
    ]);
    expect(loadSnapshots(db)).toEqual({
      openAuthoredPrs: 2,
      reviewRequestedPrs: 1,
      storiesInProgress: 3,
    });
    expect(loadSettings(db).lastSyncedAt).toBe(NOW.toISOString());
  });

  it("stores my open PRs from allowed repos only, newest first, with their review status", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(storedOpenPrUrls()).toEqual([
      "https://github.com/acme/web/pull/6",
      "https://github.com/acme/api/pull/5",
    ]);
    expect(loadOpenItems(db).map((item) => item.reviewStatus)).toEqual([
      "awaiting_review",
      "approved",
    ]);
  });

  it("drops an open PR that is no longer returned on the next sync", async () => {
    const first = fakeGitHub().run;
    await syncAll({ db, run: first, shortcut: fakeShortcut, now: () => NOW });

    const second = withOpenAuthoredPrs([openPullRequest("acme/api", 5, "2026-10-20T08:00:00Z")]);
    await syncAll({ db, run: second, shortcut: fakeShortcut, now: () => NOW });

    expect(storedOpenPrUrls()).toEqual(["https://github.com/acme/api/pull/5"]);
  });

  it("keeps the stored open PRs when the open-PR search fails", async () => {
    const healthy = fakeGitHub().run;
    await syncAll({ db, run: healthy, shortcut: fakeShortcut, now: () => NOW });

    const failing: Runner = async (command, args) => {
      if (isOpenAuthoredSearch(args)) throw new Error("search failed");
      return healthy(command, args);
    };
    const result = await syncAll({ db, run: failing, shortcut: fakeShortcut, now: () => NOW });

    expect(result.errors.github).toBe("search failed");
    expect(storedOpenPrUrls()).toEqual([
      "https://github.com/acme/web/pull/6",
      "https://github.com/acme/api/pull/5",
    ]);
  });

  it("asks GitHub for the last 60 days", async () => {
    const { run, calls } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    const created = calls.find((args) => args.includes("--created")) ?? [];
    const searches = calls.map(searchOf);
    expect(created).toContain(">=2026-08-31");
    expect(searches).toContain("is:pr author:jorden-parker is:merged merged:>=2026-08-31");
    expect(searches).toContain(
      "is:pr reviewed-by:jorden-parker -author:jorden-parker updated:>=2026-08-31",
    );
  });

  it("does not call GitHub while the allow-list is empty", async () => {
    saveSettings(db, { allowList: [] });
    const { run, calls } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(calls).toEqual([]);
  });

  it("always asks Shortcut, and reports the CLI's message when it is not set up", async () => {
    const { run } = fakeGitHub();
    const shortcut: ShortcutGet = async () => {
      throw new Error("Please run 'short install'");
    };

    const result = await syncAll({ db, run, shortcut, now: () => NOW });

    expect(result.errors.shortcut).toContain("short install");
  });

  it("reports a failing source, still syncs the other, and leaves the sync time alone", async () => {
    const failingGitHub: Runner = async () => {
      throw new Error("gh exploded");
    };

    const result = await syncAll({
      db,
      run: failingGitHub,
      shortcut: fakeShortcut,
      now: () => NOW,
    });

    expect(result.errors).toEqual({ github: "gh exploded" });
    expect(storedEvents().map((event) => event.kind)).toEqual(["story_completed"]);
    expect(
      loadTickets(db)
        .map((ticket) => ticket.role)
        .sort(),
    ).toEqual(["assigned", "completed"]);
    expect(loadSettings(db).lastSyncedAt).toBeNull();
  });

  it("keeps reviews when another GitHub call fails", async () => {
    const { run: healthyGitHub } = fakeGitHub();
    const run: Runner = async (command, args) => {
      if (searchOf(args).includes("is:merged")) throw new Error("merged search failed");
      return healthyGitHub(command, args);
    };

    const result = await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(result.errors.github).toBe("merged search failed");
    expect(storedEvents().map((event) => event.kind)).toContain("pr_reviewed");
    expect(loadSettings(db).lastSyncedAt).toBeNull();
  });

  it("stores my assigned stories as tickets with the review status of their PRs", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(ticketById("31")).toMatchObject({
      id: "31",
      title: "Plan the rollout",
      url: "https://app.shortcut.com/acme/story/31",
      openedAt: "2026-10-10T09:00:00Z",
      storyType: "feature",
      state: "In Progress",
      estimate: 3,
      role: "assigned",
      completedAt: null,
      owners: ["Jorden"],
      pullRequests: [
        { url: "https://github.com/acme/api/pull/4", title: "Shipped", isMerged: true },
        {
          url: "https://github.com/acme/api/pull/5",
          title: "Roll out",
          isDraft: true,
          isMerged: false,
          reviewStatus: "approved",
        },
      ],
    });
    expect(loadOpenItems(db).every((item) => item.source === "github")).toBe(true);
  });

  it("stores completed stories as tickets with their completion time", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(ticketById("21")).toMatchObject({
      role: "completed",
      completedAt: "2026-10-29T09:00:00Z",
    });
  });

  it("stores stories behind PRs awaiting my review as reviewing tickets, whatever the repo", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(ticketById("77")).toMatchObject({
      role: "reviewing",
      owners: ["Ada"],
      pullRequests: [
        {
          url: "https://github.com/acme/api/pull/9",
          title: "PR 9",
          isDraft: false,
          isMerged: false,
          reviewStatus: "awaiting_review",
        },
      ],
    });
    expect(ticketById("31")?.pullRequests.map((pullRequest) => pullRequest.url)).toEqual([
      "https://github.com/acme/api/pull/4",
      "https://github.com/acme/api/pull/5",
    ]);
    expect(
      loadTickets(db)
        .map((ticket) => ticket.id)
        .sort(),
    ).toEqual(["21", "31", "77"]);
  });

  it("keeps the open PRs and the stored stories when Shortcut fails", async () => {
    const { run } = fakeGitHub();
    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    const failingShortcut: ShortcutGet = async () => {
      throw new Error("shortcut down");
    };
    const result = await syncAll({ db, run, shortcut: failingShortcut, now: () => NOW });

    expect(result.errors.shortcut).toBe("shortcut down");
    expect(storedOpenPrUrls()).toEqual([
      "https://github.com/acme/web/pull/6",
      "https://github.com/acme/api/pull/5",
    ]);
    expect(loadTickets(db)).toHaveLength(3);
  });

  it("reports a failure while fetching the stories under review", async () => {
    const { run } = fakeGitHub();
    const shortcut: ShortcutGet = async <T>(path: string) => {
      if (path.includes("/stories/")) throw new Error("stories down");
      return fakeShortcut<T>(path);
    };
    const withoutStoryFetch = fakeGitHub().run;
    await syncAll({ db, run: withoutStoryFetch, shortcut: fakeShortcut, now: () => NOW });

    const result = await syncAll({ db, run, shortcut, now: () => NOW });

    expect(result.errors.shortcut).toBeUndefined();
    expect(ticketById("77")).toBeUndefined();
  });

  it("names repos whose reviews the allow-list dropped", async () => {
    const { run } = fakeGitHub();

    const result = await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(result.uncountedReviewRepos).toEqual(["stranger/lib"]);
  });
});
