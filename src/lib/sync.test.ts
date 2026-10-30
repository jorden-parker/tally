import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import type { Runner } from "@/lib/exec";
import type { ShortcutGet } from "@/lib/shortcut/client";
import { openDatabase } from "@/lib/store/database";
import { eventsBetween } from "@/lib/store/events";
import { loadSettings, loadSnapshots, saveSettings } from "@/lib/store/settings";
import { syncAll } from "./sync";

const NOW = new Date("2026-10-30T12:00:00Z");

function contributionPage(connection: string, nodes: unknown[]): string {
  return JSON.stringify({
    data: {
      viewer: {
        contributionsCollection: {
          [connection]: { pageInfo: { hasNextPage: false, endCursor: null }, nodes },
        },
      },
    },
  });
}

function pullRequest(repo: string, number: number) {
  return {
    title: `PR ${number}`,
    url: `https://github.com/${repo}/pull/${number}`,
    repository: { nameWithOwner: repo },
  };
}

function fakeGitHub(): { run: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const run: Runner = async (_command, args) => {
    calls.push(args);
    const joined = args.join(" ");
    if (args[0] === "api") {
      return joined.includes("pullRequestReviewContributions")
        ? contributionPage("pullRequestReviewContributions", [
            {
              occurredAt: "2026-10-28T10:00:00Z",
              pullRequestReview: { url: "review-allowed" },
              pullRequest: pullRequest("acme/api", 1),
            },
            {
              occurredAt: "2026-10-28T11:00:00Z",
              pullRequestReview: { url: "review-blocked" },
              pullRequest: pullRequest("stranger/lib", 2),
            },
          ])
        : contributionPage("pullRequestContributions", [
            { occurredAt: "2026-10-29T08:00:00Z", pullRequest: pullRequest("acme/web", 3) },
          ]);
    }
    if (joined.includes("--merged")) {
      return JSON.stringify([{ ...pullRequest("acme/api", 4), closedAt: "2026-10-27T16:00:00Z" }]);
    }
    if (joined.includes("--review-requested")) {
      return JSON.stringify([
        { repository: { nameWithOwner: "acme/api" } },
        { repository: { nameWithOwner: "stranger/lib" } },
      ]);
    }
    return JSON.stringify([
      { repository: { nameWithOwner: "acme/api" } },
      { repository: { nameWithOwner: "acme/web" } },
    ]);
  };
  return { run, calls };
}

const fakeShortcut: ShortcutGet = async <T>(path: string) => {
  if (path.endsWith("/member")) return { mention_name: "jorden" } as T;
  const query = new URL(path, "https://api.app.shortcut.com").searchParams.get("query") ?? "";
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

  it("asks GitHub for the last 60 days", async () => {
    const { run, calls } = fakeGitHub();

    await syncAll({ db, run, shortcut: null, now: () => NOW });

    const graphql = calls.find((args) => args[0] === "api") ?? [];
    expect(graphql).toContain("from=2026-08-31T12:00:00.000Z");
    expect(graphql).toContain("to=2026-10-30T12:00:00.000Z");
  });

  it("does not call GitHub while the allow-list is empty", async () => {
    saveSettings(db, { allowList: [] });
    const { run, calls } = fakeGitHub();

    await syncAll({ db, run, shortcut: fakeShortcut, now: () => NOW });

    expect(calls).toEqual([]);
  });

  it("skips Shortcut when there is no token", async () => {
    const { run } = fakeGitHub();

    const result = await syncAll({ db, run, shortcut: null, now: () => NOW });

    expect(result.errors).toEqual({});
    expect(storedEvents().some((event) => event.source === "shortcut")).toBe(false);
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
});
