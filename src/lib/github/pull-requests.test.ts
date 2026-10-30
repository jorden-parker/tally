import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { fetchCreatedPrs, fetchMergedPrs, fetchOpenPrRepos } from "./pull-requests";

function recordingRunner(output: unknown) {
  const calls: string[][] = [];
  const run: Runner = async (command, args) => {
    calls.push([command, ...args]);
    return JSON.stringify(output);
  };
  return { run, calls };
}

describe("fetchMergedPrs", () => {
  it("searches my merged PRs since the date and maps closedAt to the merge time", async () => {
    const { run, calls } = recordingRunner([
      {
        number: 4,
        title: "Ship it",
        url: "https://github.com/acme/api/pull/4",
        closedAt: "2026-10-27T16:00:00Z",
        repository: { nameWithOwner: "acme/api" },
      },
    ]);

    const events = await fetchMergedPrs(run, "2026-09-01");

    expect(events).toEqual([
      {
        source: "github",
        kind: "pr_merged",
        externalId: "https://github.com/acme/api/pull/4",
        occurredAt: "2026-10-27T16:00:00Z",
        repo: "acme/api",
        title: "Ship it",
        url: "https://github.com/acme/api/pull/4",
      },
    ]);
    expect(calls[0]).toEqual(
      expect.arrayContaining(["gh", "search", "prs", "--author", "@me", "--merged"]),
    );
    expect(calls[0]).toEqual(expect.arrayContaining(["--merged-at", ">=2026-09-01"]));
  });
});

describe("fetchCreatedPrs", () => {
  it("searches my PRs created since the date and maps createdAt", async () => {
    const { run, calls } = recordingRunner([
      {
        title: "Fix flake",
        url: "https://github.com/acme/web/pull/9",
        createdAt: "2026-10-29T08:00:00Z",
        repository: { nameWithOwner: "acme/web" },
      },
    ]);

    expect(await fetchCreatedPrs(run, "2026-09-01")).toEqual([
      {
        source: "github",
        kind: "pr_created",
        externalId: "https://github.com/acme/web/pull/9",
        occurredAt: "2026-10-29T08:00:00Z",
        repo: "acme/web",
        title: "Fix flake",
        url: "https://github.com/acme/web/pull/9",
      },
    ]);
    expect(calls[0]).toEqual(
      expect.arrayContaining(["--author", "@me", "--created", ">=2026-09-01"]),
    );
  });
});

describe("fetchOpenPrRepos", () => {
  it("lists repos of my open authored PRs", async () => {
    const { run, calls } = recordingRunner([
      { repository: { nameWithOwner: "acme/api" } },
      { repository: { nameWithOwner: "acme/web" } },
    ]);

    expect(await fetchOpenPrRepos(run, "authored")).toEqual(["acme/api", "acme/web"]);
    expect(calls[0]).toEqual(
      expect.arrayContaining(["--author", "@me", "--state", "open", "--json", "repository"]),
    );
  });

  it("lists repos of PRs awaiting my review", async () => {
    const { run, calls } = recordingRunner([{ repository: { nameWithOwner: "acme/api" } }]);

    expect(await fetchOpenPrRepos(run, "review-requested")).toEqual(["acme/api"]);
    expect(calls[0]).toEqual(expect.arrayContaining(["--review-requested", "@me"]));
  });
});
