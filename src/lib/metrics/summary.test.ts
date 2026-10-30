import { describe, expect, it } from "vitest";
import type { EventKind, TallyEvent } from "@/lib/store/events";
import type { OpenItem } from "@/lib/store/open-items";
import { DEFAULT_SETTINGS } from "@/lib/store/settings";
import { summarize, type SummaryInput } from "./summary";

const NOW = new Date("2026-10-30T12:00:00Z");

function event(kind: EventKind, externalId: string, occurredAt: string, url = externalId) {
  const source = kind === "story_completed" ? "shortcut" : "github";
  const repo = source === "github" ? "acme/api" : null;
  return { source, kind, externalId, occurredAt, repo, title: externalId, url } as TallyEvent;
}

const EVENTS: TallyEvent[] = [
  event("pr_reviewed", "review-1a", "2026-10-30T09:00:00Z", "pr-1"),
  event("pr_reviewed", "review-1b", "2026-10-30T10:00:00Z", "pr-1"),
  event("pr_reviewed", "review-2", "2026-10-28T10:00:00Z", "pr-2"),
  event("pr_reviewed", "review-3", "2026-10-21T10:00:00Z", "pr-3"),
  event("pr_reviewed", "review-4", "2026-10-01T10:00:00Z", "pr-4"),
  { ...event("pr_reviewed", "review-x", "2026-10-30T11:00:00Z", "pr-x"), repo: "stranger/lib" },
  event("pr_created", "created-1", "2026-10-30T08:00:00Z"),
  event("pr_merged", "merged-1", "2026-10-27T16:00:00Z"),
  event("story_completed", "story-1", "2026-10-29T09:00:00Z"),
];

function input(range: SummaryInput["range"]): SummaryInput {
  return {
    events: EVENTS,
    openItems: [],
    snapshots: { openAuthoredPrs: 2, reviewRequestedPrs: 1, storiesInProgress: 3 },
    settings: { ...DEFAULT_SETTINGS, allowList: ["acme"], timeZone: "UTC", weekStart: 1 },
    range,
    now: NOW,
  };
}

describe("summarize", () => {
  it("counts a PR reviewed several times in a day once", () => {
    expect(summarize(input("day")).current.reviewed).toBe(1);
  });

  it("compares today with yesterday", () => {
    const summary = summarize(input("day"));

    expect(summary.current).toEqual({ reviewed: 1, created: 1, merged: 0, completed: 0 });
    expect(summary.previous).toEqual({ reviewed: 0, created: 0, merged: 0, completed: 1 });
  });

  it("compares the week so far with the same stretch of the previous week", () => {
    const summary = summarize(input("week"));

    expect(summary.current).toEqual({ reviewed: 2, created: 1, merged: 1, completed: 1 });
    expect(summary.previous.reviewed).toBe(1);
  });

  it("covers the last 30 days including today", () => {
    expect(summarize(input("30d")).current.reviewed).toBe(4);
  });

  it("ignores GitHub events outside the allow-list", () => {
    const summary = summarize(input("week"));

    expect(summary.lists.reviewed.map((item) => item.url)).toEqual(["pr-1", "pr-2"]);
  });

  it("lists the period's items newest first", () => {
    const summary = summarize(input("week"));

    expect(summary.lists.completed.map((item) => item.externalId)).toEqual(["story-1"]);
    expect(summary.lists.created.map((item) => item.externalId)).toEqual(["created-1"]);
    expect(summary.lists.merged.map((item) => item.externalId)).toEqual(["merged-1"]);
  });

  it("gives 28 daily points ending today, with empty days as zero", () => {
    const { daily } = summarize(input("week"));

    expect(daily).toHaveLength(28);
    expect(daily.at(-1)).toEqual({ day: "2026-10-30", reviewed: 1, created: 1 });
    expect(daily.at(-2)).toEqual({ day: "2026-10-29", reviewed: 0, created: 0 });
    expect(daily.at(-3)).toEqual({ day: "2026-10-28", reviewed: 1, created: 0 });
  });

  it("passes through the snapshots and last sync time", () => {
    const summary = summarize({
      ...input("day"),
      settings: { ...input("day").settings, lastSyncedAt: "2026-10-30T11:00:00Z" },
    });

    expect(summary.now).toEqual({
      openAuthoredPrs: 2,
      reviewRequestedPrs: 1,
      storiesInProgress: 3,
    });
    expect(summary.lastSyncedAt).toBe("2026-10-30T11:00:00Z");
    expect(summary.range).toBe("day");
  });
});

const OPEN_ITEMS: OpenItem[] = [
  {
    source: "github",
    externalId: "https://github.com/acme/api/pull/9",
    openedAt: "2026-10-20T10:00:00Z",
    repo: "acme/api",
    title: "Tidy the proxy",
    url: "https://github.com/acme/api/pull/9",
  },
  {
    source: "github",
    externalId: "https://github.com/stranger/lib/pull/2",
    openedAt: "2026-10-21T10:00:00Z",
    repo: "stranger/lib",
    title: "Elsewhere",
    url: "https://github.com/stranger/lib/pull/2",
  },
  {
    source: "shortcut",
    externalId: "31",
    openedAt: "2026-10-10T09:00:00Z",
    repo: null,
    title: "Plan the rollout",
    url: "https://app.shortcut.com/acme/story/31",
  },
];

describe("open work", () => {
  it("splits open items into PRs and tickets, and drops PRs outside the allow-list", () => {
    const summary = summarize({ ...input("day"), openItems: OPEN_ITEMS });

    expect(summary.open.prs.map((item) => item.externalId)).toEqual([
      "https://github.com/acme/api/pull/9",
    ]);
    expect(summary.open.tickets.map((item) => item.externalId)).toEqual(["31"]);
  });

  it("keeps tickets when the allow-list no longer covers any repo", () => {
    const base = input("day");
    const summary = summarize({
      ...base,
      openItems: OPEN_ITEMS,
      settings: { ...base.settings, allowList: ["other"] },
    });

    expect(summary.open.prs).toEqual([]);
    expect(summary.open.tickets).toHaveLength(1);
  });

  it("reports the same open work for every range", () => {
    const withOpen = (range: SummaryInput["range"]) =>
      summarize({ ...input(range), openItems: OPEN_ITEMS }).open;

    expect(withOpen("week")).toEqual(withOpen("day"));
    expect(withOpen("30d")).toEqual(withOpen("day"));
  });
});
