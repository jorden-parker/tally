import { describe, expect, it } from "vitest";
import { makeWorkReport, makeWorkRow } from "@/test/fake-api";
import { formatCycleTime, prDetail, ticketDetail, workMarkdown } from "./work-markdown";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

describe("formatCycleTime", () => {
  it.each([
    [null, "—"],
    [20 * MINUTE_MS, "under an hour"],
    [HOUR_MS, "1 hour"],
    [5 * HOUR_MS, "5 hours"],
    [47 * HOUR_MS, "47 hours"],
    [48 * HOUR_MS, "2 days"],
    [80 * HOUR_MS, "3 days"],
  ])("formats %s", (milliseconds, expected) => {
    expect(formatCycleTime(milliseconds)).toBe(expected);
  });
});

describe("prDetail", () => {
  it("describes the size and how long it took to merge", () => {
    expect(prDetail(makeWorkRow("pr_merged", "Ship it"))).toBe(
      "+120 −30, 4 files · merged in 2 days",
    );
  });

  it("uses a dash when nothing is known", () => {
    const row = {
      ...makeWorkRow("pr_merged", "Old"),
      startedAt: null,
      additions: null,
      deletions: null,
      changedFiles: null,
    };

    expect(prDetail(row)).toBe("—");
  });
});

describe("ticketDetail", () => {
  it("describes the type, points and how long it took to finish", () => {
    expect(ticketDetail(makeWorkRow("story_completed", "Ship tally"))).toBe(
      "feature · 3 points · finished in 2 days",
    );
  });

  it("names a single point in the singular", () => {
    const row = { ...makeWorkRow("story_completed", "Small"), points: 1 };

    expect(ticketDetail(row)).toContain("1 point ");
  });

  it("uses a dash when nothing is known", () => {
    const row = {
      ...makeWorkRow("story_completed", "Old"),
      startedAt: null,
      points: null,
      storyType: null,
    };

    expect(ticketDetail(row)).toBe("—");
  });
});

describe("workMarkdown", () => {
  it("writes the summary and every section with links", () => {
    expect(workMarkdown(makeWorkReport())).toBe(`# Work log: 2026-10-01 to 2026-10-30

## Summary

- PRs merged: 1 (+120 −30 across 4 files)
- Tickets completed: 1 (3 points)
- Ticket types: 1 feature
- Median cycle time: PRs 2 days, tickets 2 days

## PRs merged

- 2026-10-29 [Ship it](https://example.test/Ship%20it) (acme/api): +120 −30, 4 files · merged in 2 days

## Tickets completed

- 2026-10-29 [Ship tally](https://example.test/Ship%20tally): feature · 3 points · finished in 2 days

## Draft PRs (current)

- Opened 2026-10-20 [Tidy the proxy](https://example.test/Tidy%20the%20proxy) (acme/api)
`);
  });

  it("says what the totals leave out", () => {
    const report = makeWorkReport();
    const markdown = workMarkdown({
      ...report,
      totals: { ...report.totals, prsWithoutSize: 2, unestimatedTickets: 3 },
    });

    expect(markdown).toContain("(+120 −30 across 4 files, 2 PRs without size data)");
    expect(markdown).toContain("(3 points, 3 unestimated)");
  });

  it("escapes brackets in titles so links stay intact", () => {
    const row = { ...makeWorkRow("pr_merged", "x"), title: "[API] Fix" };

    expect(workMarkdown({ ...makeWorkReport(), prs: [row] })).toContain("[\\[API\\] Fix](");
  });

  it("marks empty sections and drops the type and cycle lines when unknown", () => {
    const report = makeWorkReport();
    const markdown = workMarkdown({
      ...report,
      prs: [],
      tickets: [],
      drafts: [],
      totals: {
        ...report.totals,
        ticketsByType: [],
        medianPrCycleMs: null,
        medianTicketCycleMs: null,
      },
    });

    expect(markdown).toContain("## PRs merged\n\nNone\n");
    expect(markdown).toContain("## Draft PRs (current)\n\nNone\n");
    expect(markdown).not.toContain("Ticket types");
    expect(markdown).toContain("Median cycle time: PRs —, tickets —");
  });
});
