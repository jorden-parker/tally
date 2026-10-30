import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { Runner } from "@/lib/exec";
import type { ShortcutGet } from "@/lib/shortcut/client";
import { openDatabase } from "@/lib/store/database";
import { eventsBetween } from "@/lib/store/events";
import { loadOpenItems } from "@/lib/store/open-items";
import { loadSettings, loadSnapshots, saveSettings } from "@/lib/store/settings";
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

function reviewSearchPage(): string {
  const reviewed = (repo: string, number: number, reviewUrl: string) => ({
    ...pullRequest(repo, number),
    reviews: { nodes: [{ url: reviewUrl, submittedAt: "2026-10-28T10:00:00Z" }] },
  });
  return JSON.stringify({
    data: {
      search: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          reviewed("acme/api", 1, "review-allowed"),
          reviewed("stranger/lib", 2, "review-blocked"),
        ],
      },
    },
  });
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
  return JSON.stringify({
    data: {
      search: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [merged("acme/api", 4), merged("stranger/lib", 8)],
      },
    },
  });
}

function fakeGitHub(): { run: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const run: Runner = async (_command, args) => {
    calls.push(args);
    const joined = args.join(" ");
    if (args[0] === "api" && args[1] === "user") return "jorden-parker\n";
    if (joined.includes("is:merged")) return mergedSearchPage();
    if (args[0] === "api") return reviewSearchPage();
    if (joined.includes("--created")) {
      return JSON.stringify([{ ...pullRequest("acme/web", 3), createdAt: "2026-10-29T08:00:00Z" }]);
    }
    if (joined.includes("--review-requested")) {
      return JSON.stringify([
        { repository: { nameWithOwner: "acme/api" } },
        { repository: { nameWithOwner: "stranger/lib" } },
      ]);
    }
    return JSON.stringify([
      { ...pullRequest("acme/api", 5), createdAt: "2026-10-20T08:00:00Z", isDraft: false },
      { ...pullRequest("acme/web", 6), createdAt: "2026-10-22T08:00:00Z", isDraft: true },
      { ...pullRequest("stranger/lib", 7), createdAt: "2026-10-23T08:00:00Z", isDraft: true },
    ]);
  };
  return { run, calls };
}

function withOpenAuthoredPrs(openPrs: unknown[]): Runner {
  const { run } = fakeGitHub();
  return async (command, args) =>
    args.join(" ").includes("--author @me --state open")
      ? JSON.stringify(openPrs)
      : run(command, args);
}

const fakeShortcut: ShortcutGet = async <T>(path: string) => {
  if (path.endsWith("/member")) return { mention_name: "jorden" } as T;
  const query = new URL(path, "https://api.app.shortcut.com").searchParams.get("query") ?? "";
  if (query.includes("!is:archived")) {
    return {
      data: [
        {
          id: 31,
          name: "Plan the rollout",
          app_url: "https://app.shortcut.com/acme/story/31",
          completed_at: null,
          created_at: "2026-10-10T09:00:00Z",
        },
      ],
      next: null,
    } as T;
  }
  return (
    query.includes("is:started")
      ? { data: [], next: null, total: 3 }
      : {
          data: [
            {
              id: 21,
              name: "Ship tally",
              app_url: "https://app.shortcut.com/acme/story/21",
              completed_at: "2026-10-29T09:00:00Z",
              started_at: "2026-10-26T09:00:00Z",
              estimate: 3,
              story_type: "feature",
            },
          ],
          next: null,
        }
  ) as T;
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

  it("stores my open PRs from allowed repos only, newest first", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(storedOpenPrUrls()).toEqual([
      "https://github.com/acme/web/pull/6",
      "https://github.com/acme/api/pull/5",
    ]);
  });

  it("drops an open PR that is no longer returned on the next sync", async () => {
    const first = fakeGitHub().run;
    await syncAll({ db, run: first, shortcut: fakeShortcut, now: () => NOW });

    const second = withOpenAuthoredPrs([
      { ...pullRequest("acme/api", 5), createdAt: "2026-10-20T08:00:00Z" },
    ]);
    await syncAll({ db, run: second, shortcut: fakeShortcut, now: () => NOW });

    expect(storedOpenPrUrls()).toEqual(["https://github.com/acme/api/pull/5"]);
  });

  it("keeps the stored open PRs when the open-PR search fails", async () => {
    const healthy = fakeGitHub().run;
    await syncAll({ db, run: healthy, shortcut: fakeShortcut, now: () => NOW });

    const failing: Runner = async (command, args) => {
      if (args.join(" ").includes("--author @me --state open")) throw new Error("search failed");
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
    const merged = calls.find((args) => args.join(" ").includes("is:merged")) ?? [];
    const reviews = calls.find((args) => args[1] === "graphql") ?? [];
    expect(created).toContain(">=2026-08-31");
    expect(merged.join(" ")).toContain("merged:>=2026-08-31");
    expect(reviews).toContain(
      "search=is:pr reviewed-by:jorden-parker -author:jorden-parker updated:>=2026-08-31",
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
    expect(loadSettings(db).lastSyncedAt).toBeNull();
  });

  it("keeps reviews when another GitHub call fails", async () => {
    const { run: healthyGitHub } = fakeGitHub();
    const run: Runner = async (command, args) => {
      if (args.join(" ").includes("is:merged")) throw new Error("merged search failed");
      return healthyGitHub(command, args);
    };

    const result = await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(result.errors.github).toBe("merged search failed");
    expect(storedEvents().map((event) => event.kind)).toContain("pr_reviewed");
    expect(loadSettings(db).lastSyncedAt).toBeNull();
  });

  it("stores my assigned stories from Shortcut", async () => {
    const { run } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(loadOpenItems(db).filter((item) => item.source === "shortcut")).toEqual([
      {
        source: "shortcut",
        externalId: "31",
        openedAt: "2026-10-10T09:00:00Z",
        isDraft: false,
        repo: null,
        title: "Plan the rollout",
        url: "https://app.shortcut.com/acme/story/31",
      },
    ]);
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
    expect(loadOpenItems(db).filter((item) => item.source === "shortcut")).toHaveLength(1);
  });

  it("names repos whose reviews the allow-list dropped", async () => {
    const { run } = fakeGitHub();

    const result = await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(result.uncountedReviewRepos).toEqual(["stranger/lib"]);
  });
});
