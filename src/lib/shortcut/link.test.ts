import { describe, expect, it } from "vitest";
import type { ReviewablePullRequest } from "@/lib/github/pull-requests";
import type { Ticket } from "@/lib/store/tickets";
import { linkPullRequests } from "./link";

function ticket(id: string, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id,
    title: `Story ${id}`,
    url: `https://app.shortcut.com/acme/story/${id}`,
    openedAt: "2026-10-10T09:00:00Z",
    storyType: "feature",
    state: "In Progress",
    estimate: 3,
    role: "assigned",
    completedAt: null,
    owners: [],
    pullRequests: [],
    ...overrides,
  };
}

function pullRequest(
  number: number,
  headRefName: string,
  overrides: Partial<ReviewablePullRequest> = {},
): ReviewablePullRequest {
  return {
    source: "github",
    externalId: `https://github.com/acme/api/pull/${number}`,
    openedAt: "2026-10-20T10:00:00Z",
    isDraft: false,
    repo: "acme/api",
    title: `PR ${number}`,
    url: `https://github.com/acme/api/pull/${number}`,
    reviewStatus: "awaiting_review",
    headRefName,
    author: "ada",
    ...overrides,
  };
}

describe("linkPullRequests", () => {
  it("attaches a PR to every ticket its branch name or title mentions", () => {
    const linked = linkPullRequests([ticket("12"), ticket("34"), ticket("56")], {
      authored: [
        pullRequest(1, "ada/sc-12-and-more", { title: "Also closes sc-34", isDraft: true }),
      ],
      toReview: [],
      mergedUrls: [],
    });

    expect(linked.map((item) => item.pullRequests)).toEqual([
      [
        {
          url: "https://github.com/acme/api/pull/1",
          title: "Also closes sc-34",
          isDraft: true,
          isMerged: false,
          reviewStatus: "awaiting_review",
        },
      ],
      [
        {
          url: "https://github.com/acme/api/pull/1",
          title: "Also closes sc-34",
          isDraft: true,
          isMerged: false,
          reviewStatus: "awaiting_review",
        },
      ],
      [],
    ]);
  });

  it("leaves a PR Shortcut already attached alone", () => {
    const attached = {
      url: "https://github.com/acme/api/pull/1",
      title: "Shortcut's title",
      isDraft: false,
      isMerged: false,
      reviewStatus: null,
    };

    const [linked] = linkPullRequests([ticket("12", { pullRequests: [attached] })], {
      authored: [pullRequest(1, "sc-12")],
      toReview: [],
      mergedUrls: [],
    });

    expect(linked?.pullRequests).toEqual([attached]);
  });

  it("returns tickets unchanged when no PR mentions them", () => {
    const tickets = [ticket("12")];

    expect(
      linkPullRequests(tickets, {
        authored: [pullRequest(1, "main")],
        toReview: [],
        mergedUrls: [],
      }),
    ).toEqual(tickets);
  });

  it("links only my PRs to assigned and completed tickets", () => {
    const linked = linkPullRequests(
      [ticket("12"), ticket("34", { role: "completed", completedAt: "2026-10-29T09:00:00Z" })],
      {
        authored: [pullRequest(1, "sc-12")],
        toReview: [pullRequest(2, "grace/sc-12-sc-34", { author: "grace" })],
        mergedUrls: [],
      },
    );

    expect(linked.map((item) => item.pullRequests.map((pullRequest) => pullRequest.url))).toEqual([
      ["https://github.com/acme/api/pull/1"],
      [],
    ]);
  });

  it("drops a Shortcut-attached PR that I am reviewing from my own ticket", () => {
    const mine = {
      url: "https://github.com/acme/api/pull/1",
      title: "Mine",
      isDraft: false,
      isMerged: false,
      reviewStatus: null,
    };
    const theirs = { ...mine, url: "https://github.com/acme/api/pull/2", title: "Theirs" };

    const [linked] = linkPullRequests([ticket("12", { pullRequests: [mine, theirs] })], {
      authored: [pullRequest(1, "main")],
      toReview: [pullRequest(2, "grace/sc-12", { author: "grace" })],
      mergedUrls: [],
    });

    expect(linked?.pullRequests).toEqual([mine]);
  });

  it("drops a Shortcut-attached PR that GitHub does not list as mine", () => {
    const theirs = {
      url: "https://github.com/acme/api/pull/2",
      title: "Theirs",
      isDraft: false,
      isMerged: false,
      reviewStatus: null,
    };

    const [linked] = linkPullRequests([ticket("12", { pullRequests: [theirs] })], {
      authored: [],
      toReview: [],
      mergedUrls: [],
    });

    expect(linked?.pullRequests).toEqual([]);
  });

  it("keeps a Shortcut-attached PR that I merged", () => {
    const merged = {
      url: "https://github.com/acme/api/pull/3",
      title: "Merged",
      isDraft: false,
      isMerged: true,
      reviewStatus: null,
    };

    const [linked] = linkPullRequests([ticket("12", { pullRequests: [merged] })], {
      authored: [],
      toReview: [],
      mergedUrls: ["https://github.com/acme/api/pull/3"],
    });

    expect(linked?.pullRequests).toEqual([merged]);
  });

  it("links my PRs and the PRs I review to reviewing tickets", () => {
    const [linked] = linkPullRequests([ticket("12", { role: "reviewing", owners: ["Grace"] })], {
      authored: [pullRequest(1, "sc-12")],
      toReview: [pullRequest(2, "grace/sc-12", { author: "grace" })],
      mergedUrls: [],
    });

    expect(linked?.pullRequests.map((pullRequest) => pullRequest.url)).toEqual([
      "https://github.com/acme/api/pull/1",
      "https://github.com/acme/api/pull/2",
    ]);
  });
});
