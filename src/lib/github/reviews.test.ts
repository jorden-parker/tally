import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { fetchReviewedPrs } from "./reviews";

const SINCE = "2026-09-01";

function pullRequest(url: string, reviews: { url: string; submittedAt: string | null }[]) {
  return {
    title: `Title of ${url}`,
    url,
    repository: { nameWithOwner: "acme/api" },
    reviews: { nodes: reviews },
  };
}

function searchPage(nodes: unknown[], endCursor: string | null) {
  return JSON.stringify({
    data: { search: { pageInfo: { hasNextPage: endCursor !== null, endCursor }, nodes } },
  });
}

function argValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

function runnerFor(pages: (after: string | undefined) => string) {
  const graphqlCalls: string[][] = [];
  const run: Runner = async (_command, args) => {
    if (args[0] === "api" && args[1] === "user") return "jorden-parker\n";
    graphqlCalls.push(args);
    return pages(argValue(args, "after"));
  };
  return { run, graphqlCalls };
}

describe("fetchReviewedPrs", () => {
  it("maps each submitted review of someone else's PR to an event", async () => {
    const { run } = runnerFor(() =>
      searchPage(
        [
          pullRequest("https://github.com/acme/api/pull/7", [
            { url: "review-1", submittedAt: "2026-10-28T10:00:00Z" },
          ]),
        ],
        null,
      ),
    );

    expect(await fetchReviewedPrs(run, SINCE)).toEqual([
      {
        source: "github",
        kind: "pr_reviewed",
        externalId: "review-1",
        occurredAt: "2026-10-28T10:00:00Z",
        repo: "acme/api",
        title: "Title of https://github.com/acme/api/pull/7",
        url: "https://github.com/acme/api/pull/7",
      },
    ]);
  });

  it("searches for PRs I reviewed but did not author, updated since the date", async () => {
    const { run, graphqlCalls } = runnerFor(() => searchPage([], null));

    await fetchReviewedPrs(run, SINCE);

    expect(argValue(graphqlCalls[0], "search")).toBe(
      "is:pr reviewed-by:jorden-parker -author:jorden-parker updated:>=2026-09-01",
    );
    expect(argValue(graphqlCalls[0], "login")).toBe("jorden-parker");
  });

  it("skips pending reviews and reviews from before the window", async () => {
    const { run } = runnerFor(() =>
      searchPage(
        [
          pullRequest("pr-1", [
            { url: "pending", submittedAt: null },
            { url: "old", submittedAt: "2026-08-15T10:00:00Z" },
            { url: "recent", submittedAt: "2026-10-01T10:00:00Z" },
          ]),
        ],
        null,
      ),
    );

    const events = await fetchReviewedPrs(run, SINCE);

    expect(events.map((event) => event.externalId)).toEqual(["recent"]);
  });

  it("follows the cursor to the next page", async () => {
    const { run, graphqlCalls } = runnerFor((after) =>
      after === undefined
        ? searchPage(
            [pullRequest("pr-1", [{ url: "a", submittedAt: "2026-10-01T10:00:00Z" }])],
            "cursor-1",
          )
        : searchPage(
            [pullRequest("pr-2", [{ url: "b", submittedAt: "2026-10-02T10:00:00Z" }])],
            null,
          ),
    );

    const events = await fetchReviewedPrs(run, SINCE);

    expect(events.map((event) => event.externalId)).toEqual(["a", "b"]);
    expect(argValue(graphqlCalls[1], "after")).toBe("cursor-1");
  });
});
