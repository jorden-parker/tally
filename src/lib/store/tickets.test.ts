import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import { loadTickets, replaceTickets, type Ticket } from "./tickets";

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "31",
    title: "Plan the rollout",
    url: "https://app.shortcut.com/acme/story/31",
    openedAt: "2026-10-10T09:00:00Z",
    storyType: "feature",
    state: "In Progress",
    estimate: 3,
    pullRequests: [],
    ...overrides,
  };
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
        {
          url: "https://github.com/acme/api/pull/8",
          title: "Ship",
          isDraft: false,
          isMerged: true,
        },
        {
          url: "https://github.com/acme/api/pull/9",
          title: "Tidy",
          isDraft: true,
          isMerged: false,
        },
      ],
    });
    replaceTickets(db, [item]);

    expect(loadTickets(db)).toEqual([item]);
  });

  it("lists tickets newest first", () => {
    replaceTickets(db, [
      ticket({ id: "1", openedAt: "2026-10-01T09:00:00Z" }),
      ticket({ id: "2", openedAt: "2026-10-20T09:00:00Z" }),
    ]);

    expect(loadTickets(db).map((item) => item.id)).toEqual(["2", "1"]);
  });

  it("replaces every ticket and pull request on each call", () => {
    replaceTickets(db, [
      ticket({
        id: "1",
        pullRequests: [{ url: "https://x/1", title: "Old", isDraft: false, isMerged: false }],
      }),
    ]);
    replaceTickets(db, [ticket({ id: "2" })]);

    expect(loadTickets(db)).toEqual([ticket({ id: "2" })]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM ticket_pull_requests").get()).toEqual({ n: 0 });
  });
});
