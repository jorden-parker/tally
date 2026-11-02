import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import {
  fetchCreatedPrs,
  fetchMergedPrs,
  fetchOpenAuthoredPrs,
  fetchPullRequestsToReview,
} from "./pull-requests";

function recordingRunner(output: unknown) {
  const calls: string[][] = [];
  const run: Runner = async (command, args) => {
    calls.push([command, ...args]);
    return JSON.stringify(output);
  };
  return { run, calls };
}

function searchPage(nodes: unknown[]) {
  return JSON.stringify({
    data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
  });
}

function argValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

function graphqlRunner(pages: (search: string) => unknown[]) {
  const searches: string[] = [];
  const run: Runner = async (_command, args) => {
    if (args[1] === "user") return "jorden-parker\n";
    const search = argValue(args, "search") ?? "";
    searches.push(search);
    return searchPage(pages(search));
  };
  return { run, searches };
}

function openPullRequest(number: number, overrides: Record<string, unknown> = {}) {
  return {
    title: `PR ${number}`,
    url: `https://github.com/acme/api/pull/${number}`,
    createdAt: "2026-10-20T08:00:00Z",
    isDraft: false,
    headRefName: `jorden/sc-${number}-slug`,
    author: { login: "jorden-parker" },
    repository: { nameWithOwner: "acme/api" },
    reviewDecision: null,
    reviews: { totalCount: 0 },
    myReviews: { nodes: [] },
    ...overrides,
  };
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
  it("searches my open PRs and maps them with their branch, author and review status", async () => {
    const { run, searches } = graphqlRunner(() => [openPullRequest(4)]);

    expect(await fetchOpenAuthoredPrs(run)).toEqual([
      {
        source: "github",
        externalId: "https://github.com/acme/api/pull/4",
        openedAt: "2026-10-20T08:00:00Z",
        isDraft: false,
        repo: "acme/api",
        title: "PR 4",
        url: "https://github.com/acme/api/pull/4",
        reviewStatus: "awaiting_review",
        headRefName: "jorden/sc-4-slug",
        author: "jorden-parker",
      },
    ]);
    expect(searches).toEqual(["is:pr is:open author:jorden-parker"]);
  });

  it.each([
    ["APPROVED", 2, "approved"],
    ["CHANGES_REQUESTED", 2, "changes_requested"],
    ["REVIEW_REQUIRED", 1, "in_review"],
    [null, 1, "in_review"],
    ["REVIEW_REQUIRED", 0, "awaiting_review"],
  ])("derives %s with %i reviews as %s", async (reviewDecision, totalCount, expected) => {
    const { run } = graphqlRunner(() => [
      openPullRequest(1, { reviewDecision, reviews: { totalCount } }),
    ]);

    const [pullRequest] = await fetchOpenAuthoredPrs(run);

    expect(pullRequest?.reviewStatus).toBe(expected);
  });

  it("keeps the draft flag and the status of a draft", async () => {
    const { run } = graphqlRunner(() => [openPullRequest(8, { isDraft: true })]);

    const [pullRequest] = await fetchOpenAuthoredPrs(run);

    expect(pullRequest).toMatchObject({ isDraft: true, reviewStatus: "awaiting_review" });
  });

  it("leaves the author blank when GitHub no longer knows them", async () => {
    const { run } = graphqlRunner(() => [openPullRequest(8, { author: null })]);

    const [pullRequest] = await fetchOpenAuthoredPrs(run);

    expect(pullRequest?.author).toBe("");
  });
});

describe("fetchPullRequestsToReview", () => {
  function myReview(state: string) {
    return { myReviews: { nodes: [{ state }] }, author: { login: "ada" } };
  }

  it("searches PRs requesting my review and PRs I have reviewed but not written", async () => {
    const { run, searches } = graphqlRunner(() => []);

    await fetchPullRequestsToReview(run);

    expect(searches).toEqual([
      "is:pr is:open review-requested:jorden-parker",
      "is:pr is:open reviewed-by:jorden-parker -author:jorden-parker",
    ]);
  });

  it("reports the status from my side and dedupes PRs found by both searches", async () => {
    const { run } = graphqlRunner((search) =>
      search.includes("review-requested")
        ? [
            openPullRequest(1, { author: { login: "ada" } }),
            openPullRequest(2, myReview("COMMENTED")),
          ]
        : [
            openPullRequest(2, myReview("COMMENTED")),
            openPullRequest(3, myReview("CHANGES_REQUESTED")),
          ],
    );

    const pullRequests = await fetchPullRequestsToReview(run);

    expect(pullRequests.map((pullRequest) => [pullRequest.url, pullRequest.reviewStatus])).toEqual([
      ["https://github.com/acme/api/pull/1", "awaiting_review"],
      ["https://github.com/acme/api/pull/2", "in_review"],
      ["https://github.com/acme/api/pull/3", "changes_requested"],
    ]);
    expect(pullRequests[0]?.author).toBe("ada");
  });

  it("drops PRs I have already approved", async () => {
    const { run } = graphqlRunner(() => [
      openPullRequest(1, myReview("APPROVED")),
      openPullRequest(2, myReview("COMMENTED")),
    ]);

    const pullRequests = await fetchPullRequestsToReview(run);

    expect(pullRequests.map((pullRequest) => pullRequest.url)).toEqual([
      "https://github.com/acme/api/pull/2",
    ]);
  });
});
