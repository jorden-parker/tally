import { describe, expect, it } from "vitest";
import type { OpenItem } from "@/lib/store/open-items";
import type { Settings } from "@/lib/store/settings";
import type { WorkItem } from "@/lib/store/work";
import { cycleTimeMs, workReport } from "./work";

const HOUR_MS = 60 * 60 * 1000;

const SETTINGS: Settings = {
  allowList: ["acme"],
  weekStart: 1,
  timeZone: "UTC",
  lastSyncedAt: null,
};

const PERIOD = { from: "2026-10-01", to: "2026-10-31" };

function pr(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    source: "github",
    kind: "pr_merged",
    externalId: "pr",
    occurredAt: "2026-10-27T16:00:00Z",
    repo: "acme/api",
    title: "Ship it",
    url: "https://github.com/acme/api/pull/4",
    startedAt: "2026-10-27T12:00:00Z",
    points: null,
    storyType: null,
    additions: 120,
    deletions: 30,
    changedFiles: 4,
    ...overrides,
  };
}

function ticket(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    source: "shortcut",
    kind: "story_completed",
    externalId: "21",
    occurredAt: "2026-10-29T09:00:00Z",
    repo: null,
    title: "Ship tally",
    url: "https://app.shortcut.com/acme/story/21",
    startedAt: "2026-10-29T07:00:00Z",
    points: 3,
    storyType: "feature",
    additions: null,
    deletions: null,
    changedFiles: null,
    ...overrides,
  };
}

function draft(overrides: Partial<OpenItem> = {}): OpenItem {
  return {
    source: "github",
    externalId: "draft",
    openedAt: "2026-10-28T08:00:00Z",
    isDraft: true,
    repo: "acme/api",
    title: "Work in progress",
    url: "https://github.com/acme/api/pull/8",
    ...overrides,
  };
}

function report(items: WorkItem[], openItems: OpenItem[] = [], settings = SETTINGS) {
  return workReport({ items, openItems, settings, period: PERIOD });
}

describe("cycleTimeMs", () => {
  it("measures from the start to the completion", () => {
    expect(cycleTimeMs(pr())).toBe(4 * HOUR_MS);
  });

  it("is null when the start is unknown", () => {
    expect(cycleTimeMs(pr({ startedAt: null }))).toBeNull();
  });
});

describe("workReport", () => {
  it("splits work into PRs and tickets, labelled with their day", () => {
    const result = report([ticket(), pr()]);

    expect(result.from).toBe("2026-10-01");
    expect(result.to).toBe("2026-10-31");
    expect(result.prs.map((item) => [item.title, item.day])).toEqual([["Ship it", "2026-10-27"]]);
    expect(result.tickets.map((item) => [item.title, item.day])).toEqual([
      ["Ship tally", "2026-10-29"],
    ]);
  });

  it("totals size, points and types", () => {
    const { totals } = report([
      pr(),
      pr({ externalId: "pr-2", additions: 10, deletions: 5, changedFiles: 1 }),
      ticket(),
      ticket({ externalId: "22", points: 2, storyType: "bug" }),
      ticket({ externalId: "23", points: null, storyType: "bug" }),
    ]);

    expect(totals).toMatchObject({
      prsMerged: 2,
      additions: 130,
      deletions: 35,
      changedFiles: 5,
      ticketsCompleted: 3,
      points: 5,
      unestimatedTickets: 1,
      ticketsByType: [
        { key: "bug", count: 2 },
        { key: "feature", count: 1 },
      ],
    });
  });

  it("counts a zero-point ticket as estimated", () => {
    expect(report([ticket({ points: 0 })]).totals.unestimatedTickets).toBe(0);
  });

  it("takes the median cycle time, averaging the middle pair", () => {
    const { totals } = report([
      pr({ externalId: "a", startedAt: "2026-10-27T15:00:00Z" }),
      pr({ externalId: "b", startedAt: "2026-10-27T13:00:00Z" }),
      ticket({ externalId: "c", startedAt: "2026-10-29T08:00:00Z" }),
      ticket({ externalId: "d", startedAt: "2026-10-29T06:00:00Z" }),
      ticket({ externalId: "e", startedAt: "2026-10-28T09:00:00Z" }),
    ]);

    expect(totals.medianPrCycleMs).toBe(2 * HOUR_MS);
    expect(totals.medianTicketCycleMs).toBe(3 * HOUR_MS);
  });

  it("leaves missing details out instead of counting them as zero", () => {
    const { totals } = report([
      pr(),
      pr({
        externalId: "old",
        startedAt: null,
        additions: null,
        deletions: null,
        changedFiles: null,
      }),
      ticket({ startedAt: null, storyType: null }),
    ]);

    expect(totals.additions).toBe(120);
    expect(totals.prsWithoutSize).toBe(1);
    expect(totals.medianPrCycleMs).toBe(4 * HOUR_MS);
    expect(totals.medianTicketCycleMs).toBeNull();
    expect(totals.ticketsByType).toEqual([]);
  });

  it("has no median when there is no work", () => {
    expect(report([]).totals).toMatchObject({
      prsMerged: 0,
      medianPrCycleMs: null,
      medianTicketCycleMs: null,
    });
  });

  it("uses the configured time zone for the period edges", () => {
    const lateEvening = pr({ occurredAt: "2026-11-01T03:00:00Z" });

    expect(report([lateEvening]).prs).toEqual([]);
    expect(
      report([lateEvening], [], { ...SETTINGS, timeZone: "America/New_York" }).prs.map(
        (item) => item.day,
      ),
    ).toEqual(["2026-10-31"]);
  });

  it("hides PRs once their repo leaves the allow-list, but keeps tickets", () => {
    const result = report([pr({ repo: "stranger/lib" }), ticket()]);

    expect(result.prs).toEqual([]);
    expect(result.tickets).toHaveLength(1);
  });

  it("lists current allowed drafts whatever the period, and keeps them out of the totals", () => {
    const result = report(
      [],
      [
        draft({ openedAt: "2025-01-01T08:00:00Z" }),
        draft({ externalId: "ready", isDraft: false }),
        draft({ externalId: "blocked", repo: "stranger/lib" }),
      ],
    );

    expect(result.drafts.map((item) => [item.externalId, item.day])).toEqual([
      ["draft", "2025-01-01"],
    ]);
    expect(result.totals.prsMerged).toBe(0);
  });
});
