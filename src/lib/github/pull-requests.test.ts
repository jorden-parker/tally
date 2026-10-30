import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import {
  fetchCreatedPrs,
  fetchMergedPrs,
  fetchOpenAuthoredPrs,
  fetchReviewRequestedRepos,
} from "./pull-requests";

function recordingRunner(output: unknown) {
  const calls: string[][] = [];
  const run: Runner = async (command, args) => {
    calls.push([command, ...args]);
    return JSON.stringify(output);
  };
  return { run, calls };
}

describe("fetchMergedPrs", () => {
  const MERGED_PAGE = {
    data: {
      search: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            title: "Ship it",
            url: "https://github.com/acme/api/pull/4",
            createdAt: "2026-10-25T16:00:00Z",
            mergedAt: "2026-10-27T16:00:00Z",
            additions: 120,
            deletions: 30,
            changedFiles: 4,
            repository: { nameWithOwner: "acme/api" },
          },
        ],
      },
    },
  };

  function fakeGitHub() {
    const calls: string[][] = [];
    const run: Runner = async (_command, args) => {
      calls.push(args);
      return args[1] === "user" ? "jorden-parker\n" : JSON.stringify(MERGED_PAGE);
    };
    return { run, calls };
  }

  it("maps my merged PRs with their size and opening time", async () => {
    const { run } = fakeGitHub();

    expect(await fetchMergedPrs(run, "2026-09-01")).toEqual([
      {
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
      },
    ]);
  });

  it("searches merged PRs by my login since the date", async () => {
    const { run, calls } = fakeGitHub();

    await fetchMergedPrs(run, "2026-09-01");

    expect(calls[1]).toContain("search=is:pr author:jorden-parker is:merged merged:>=2026-09-01");
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

describe("fetchOpenAuthoredPrs", () => {
  it("maps my open PRs to open items and searches with the open-state filters", async () => {
    const { run, calls } = recordingRunner([
      {
        title: "Tidy the proxy",
        url: "https://github.com/acme/api/pull/4",
        createdAt: "2026-10-20T08:00:00Z",
        isDraft: false,
        repository: { nameWithOwner: "acme/api" },
      },
    ]);

    expect(await fetchOpenAuthoredPrs(run)).toEqual([
      {
        source: "github",
        externalId: "https://github.com/acme/api/pull/4",
        openedAt: "2026-10-20T08:00:00Z",
        isDraft: false,
        repo: "acme/api",
        title: "Tidy the proxy",
        url: "https://github.com/acme/api/pull/4",
      },
    ]);
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        "--author",
        "@me",
        "--state",
        "open",
        "--json",
        "title,url,createdAt,isDraft,repository",
      ]),
    );
  });
});

describe("fetchOpenAuthoredPrs", () => {
  it("marks draft PRs and asks for the draft flag", async () => {
    const { run, calls } = recordingRunner([
      {
        title: "Work in progress",
        url: "https://github.com/acme/api/pull/8",
        createdAt: "2026-10-28T08:00:00Z",
        isDraft: true,
        repository: { nameWithOwner: "acme/api" },
      },
    ]);

    const [item] = await fetchOpenAuthoredPrs(run);

    expect(item?.isDraft).toBe(true);
    expect(calls[0]).toContain("title,url,createdAt,isDraft,repository");
  });
});

describe("fetchReviewRequestedRepos", () => {
  it("lists repos of PRs awaiting my review", async () => {
    const { run, calls } = recordingRunner([{ repository: { nameWithOwner: "acme/api" } }]);

    expect(await fetchReviewRequestedRepos(run)).toEqual(["acme/api"]);
    expect(calls[0]).toEqual(
      expect.arrayContaining(["--review-requested", "@me", "--state", "open"]),
    );
  });
});
