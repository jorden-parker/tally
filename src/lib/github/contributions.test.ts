import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { fetchCreatedPrs, fetchReviewedPrs } from "./contributions";

const WINDOW = { from: "2026-09-01T00:00:00Z", to: "2026-10-30T00:00:00Z" };

function page(connection: string, nodes: unknown[], endCursor: string | null) {
  return JSON.stringify({
    data: {
      viewer: {
        contributionsCollection: {
          [connection]: {
            pageInfo: { hasNextPage: endCursor !== null, endCursor },
            nodes,
          },
        },
      },
    },
  });
}

function argValue(args: string[], name: string): string | undefined {
  const entry = args.find((arg) => arg.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

describe("fetchReviewedPrs", () => {
  it("maps review contributions to events", async () => {
    const run: Runner = async () =>
      page(
        "pullRequestReviewContributions",
        [
          {
            occurredAt: "2026-10-28T10:00:00Z",
            pullRequestReview: { url: "https://github.com/acme/api/pull/7#review-1" },
            pullRequest: {
              title: "Add retries",
              url: "https://github.com/acme/api/pull/7",
              repository: { nameWithOwner: "acme/api" },
            },
          },
        ],
        null,
      );

    expect(await fetchReviewedPrs(run, WINDOW)).toEqual([
      {
        source: "github",
        kind: "pr_reviewed",
        externalId: "https://github.com/acme/api/pull/7#review-1",
        occurredAt: "2026-10-28T10:00:00Z",
        repo: "acme/api",
        title: "Add retries",
        url: "https://github.com/acme/api/pull/7",
      },
    ]);
  });

  it("passes the window to gh and follows the cursor to the next page", async () => {
    const calls: string[][] = [];
    const node = (id: string) => ({
      occurredAt: "2026-10-28T10:00:00Z",
      pullRequestReview: { url: id },
      pullRequest: { title: id, url: id, repository: { nameWithOwner: "acme/api" } },
    });
    const run: Runner = async (_command, args) => {
      calls.push(args);
      return argValue(args, "after") === undefined
        ? page("pullRequestReviewContributions", [node("a")], "cursor-1")
        : page("pullRequestReviewContributions", [node("b")], null);
    };

    const events = await fetchReviewedPrs(run, WINDOW);

    expect(events.map((event) => event.externalId)).toEqual(["a", "b"]);
    expect(calls).toHaveLength(2);
    expect(argValue(calls[0], "from")).toBe(WINDOW.from);
    expect(argValue(calls[0], "to")).toBe(WINDOW.to);
    expect(argValue(calls[1], "after")).toBe("cursor-1");
  });
});

describe("fetchCreatedPrs", () => {
  it("maps pull request contributions to events keyed by the PR url", async () => {
    const run: Runner = async () =>
      page(
        "pullRequestContributions",
        [
          {
            occurredAt: "2026-10-29T08:00:00Z",
            pullRequest: {
              title: "Fix flake",
              url: "https://github.com/acme/web/pull/9",
              repository: { nameWithOwner: "acme/web" },
            },
          },
        ],
        null,
      );

    expect(await fetchCreatedPrs(run, WINDOW)).toEqual([
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
  });
});
