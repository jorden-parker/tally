import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import { replacePullRequestReviews } from "./pull-request-reviews";
import { loadTickets, replaceTickets, type Ticket, type TicketPullRequest } from "./tickets";

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "31",
    title: "Plan the rollout",
    url: "https://app.shortcut.com/acme/story/31",
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

function pullRequest(url: string, overrides: Partial<TicketPullRequest> = {}): TicketPullRequest {
  return { url, title: "Ship", isDraft: false, isMerged: false, reviewStatus: null, ...overrides };
}

describe("tickets store", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("round-trips a ticket without pull requests, keeping nulls", () => {
    const item = ticket({ storyType: null, estimate: null });
    replaceTickets(db, [item]);

    expect(loadTickets(db)).toEqual([item]);
  });

  it("round-trips a ticket with its pull requests", () => {
    const item = ticket({
      pullRequests: [
        pullRequest("https://github.com/acme/api/pull/8", { isMerged: true }),
        pullRequest("https://github.com/acme/api/pull/9", { title: "Tidy", isDraft: true }),
      ],
    });
    replaceTickets(db, [item]);

    expect(loadTickets(db)).toEqual([item]);
  });

  it("round-trips the role, completion time and owners", () => {
    const item = ticket({
      role: "completed",
      completedAt: "2026-10-29T09:00:00Z",
      owners: ["Ada", "Grace"],
    });
    replaceTickets(db, [item]);

    expect(loadTickets(db)).toEqual([item]);
  });

  it("reads the review status from the pull request reviews, not the ticket", () => {
    replaceTickets(db, [
      ticket({ pullRequests: [pullRequest("https://x/1", { reviewStatus: "approved" })] }),
    ]);
    replacePullRequestReviews(db, [{ url: "https://x/1", status: "in_review" }]);

    expect(loadTickets(db)[0]?.pullRequests[0]?.reviewStatus).toBe("in_review");
  });

  it("lists tickets newest first", () => {
    replaceTickets(db, [
      ticket({ id: "1", openedAt: "2026-10-01T09:00:00Z" }),
      ticket({ id: "2", openedAt: "2026-10-20T09:00:00Z" }),
    ]);

    expect(loadTickets(db).map((item) => item.id)).toEqual(["2", "1"]);
  });

  it("replaces every ticket, pull request, role and owner on each call", () => {
    replaceTickets(db, [
      ticket({ id: "1", owners: ["Ada"], pullRequests: [pullRequest("https://x/1")] }),
    ]);
    replaceTickets(db, [ticket({ id: "2" })]);

    expect(loadTickets(db)).toEqual([ticket({ id: "2" })]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM ticket_pull_requests").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM ticket_owners").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM ticket_roles").get()).toEqual({ n: 1 });
  });
});
