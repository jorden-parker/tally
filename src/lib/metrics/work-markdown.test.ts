import { describe, expect, it } from "vitest";
import { makeWorkReport, makeWorkRow } from "@/test/fake-api";
import { detailParts, formatCycleTime, prNumber, workMarkdown } from "./work-markdown";

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

describe("prNumber", () => {
  it("reads the number from a pull request url", () => {
    expect(prNumber("https://github.com/acme/api/pull/12")).toBe("#12");
  });

  it("is null for any other url", () => {
    expect(prNumber("https://example.test/Ship%20it")).toBeNull();
  });
});

describe("detailParts", () => {
  it("describes a PR by repo, number, size, files and time to merge", () => {
    const row = {
      ...makeWorkRow("pr_merged", "Ship it"),
      url: "https://github.com/acme/api/pull/12",
    };

    expect(detailParts(row)).toEqual([
      "acme/api",
      "#12",
      "+120 −30",
      "4 files",
      "merged in 2 days",
    ]);
  });

  it("describes a ticket by id, type, points and time to finish", () => {
    expect(detailParts(makeWorkRow("story_completed", "Ship tally"))).toEqual([
      "sc-Ship tally",
      "feature",
      "3 points",
      "finished in 2 days",
    ]);
  });

  it("names a single point and a single file in the singular", () => {
    const ticket = { ...makeWorkRow("story_completed", "Small"), points: 1 };
    const pr = { ...makeWorkRow("pr_merged", "Tiny"), changedFiles: 1 };

    expect(detailParts(ticket)).toContain("1 point");
    expect(detailParts(pr)).toContain("1 file");
  });

  it("leaves out whatever is unknown", () => {
    const row = {
      ...makeWorkRow("story_completed", "Old"),
      startedAt: null,
      points: null,
      storyType: null,
    };

    expect(detailParts(row)).toEqual(["sc-Old"]);
  });
});

describe("workMarkdown", () => {
  it("writes the lead, summary and every section grouped by day", () => {
    expect(workMarkdown(makeWorkReport())).toBe(`# Work log: 2026-10-01 to 2026-10-30

1 PR merged and 1 ticket completed.

## Summary

- PRs merged: 1 · +120 −30 across 4 files · median cycle time 2 days
- Tickets completed: 1 · 3 points · 1 feature · median cycle time 2 days

## PRs merged (1)

### 2026-10-29

- [Ship it](https://example.test/Ship%20it) · acme/api · +120 −30 · 4 files · merged in 2 days

## Tickets completed (1)

### 2026-10-29

- [Ship tally](https://example.test/Ship%20tally) · sc-Ship tally · feature · 3 points · finished in 2 days

## Drafts in progress (1)

- [Tidy the proxy](https://example.test/Tidy%20the%20proxy) · acme/api · opened 2026-10-20
`);
  });

  it("says what the totals leave out", () => {
    const report = makeWorkReport();
    const markdown = workMarkdown({
      ...report,
      totals: { ...report.totals, prsWithoutSize: 2, unestimatedTickets: 1 },
    });

    expect(markdown).toContain(
      "- Not counted: 2 PRs without size data, 1 ticket without an estimate\n",
    );
  });

  it("writes the review status of a draft when it is known", () => {
    const report = makeWorkReport();
    const [draft] = report.drafts;
    const markdown = workMarkdown({
      ...report,
      drafts: draft === undefined ? [] : [{ ...draft, reviewStatus: "awaiting_review" }],
    });

    expect(markdown).toContain("· opened 2026-10-20 · awaiting review\n");
  });

  it("escapes brackets in titles so links stay intact", () => {
    const row = { ...makeWorkRow("pr_merged", "x"), title: "[API] Fix" };

    expect(workMarkdown({ ...makeWorkReport(), prs: [row] })).toContain("[\\[API\\] Fix](");
  });

  it("marks empty sections and drops size, types and cycle times when there is nothing", () => {
    const report = makeWorkReport();
    const markdown = workMarkdown({
      ...report,
      prs: [],
      tickets: [],
      drafts: [],
      totals: {
        ...report.totals,
        prsMerged: 0,
        ticketsCompleted: 0,
        ticketsByType: [],
        medianPrCycleMs: null,
        medianTicketCycleMs: null,
      },
    });

    expect(markdown).toContain("0 PRs merged and 0 tickets completed.");
    expect(markdown).toContain("- PRs merged: 0\n- Tickets completed: 0\n");
    expect(markdown).toContain("## PRs merged (0)\n\nNone\n");
    expect(markdown).toContain("## Drafts in progress (0)\n\nNone\n");
    expect(markdown).not.toContain("Not counted");
  });
});
