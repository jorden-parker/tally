import { describe, expect, it } from "vitest";
import {
  comparisonLabel,
  deltaText,
  formatDay,
  formatSynced,
  isStale,
  tallyGroups,
} from "./format";

describe("comparisonLabel", () => {
  it("names the period each range is compared with", () => {
    expect(comparisonLabel("day")).toBe("yesterday");
    expect(comparisonLabel("week")).toBe("this point last week");
    expect(comparisonLabel("30d")).toBe("the 30 days before");
  });
});

describe("deltaText", () => {
  it("says more, fewer or the same against the previous period", () => {
    expect(deltaText(5, 3, "day")).toBe("2 more than yesterday");
    expect(deltaText(1, 4, "week")).toBe("3 fewer than this point last week");
    expect(deltaText(2, 2, "30d")).toBe("same as the 30 days before");
  });
});

describe("isStale", () => {
  const now = new Date("2026-10-30T12:00:00Z");

  it("is stale when never synced", () => {
    expect(isStale(null, now, 600_000)).toBe(true);
  });

  it("is stale once older than the maximum age", () => {
    expect(isStale("2026-10-30T11:49:00Z", now, 600_000)).toBe(true);
    expect(isStale("2026-10-30T11:55:00Z", now, 600_000)).toBe(false);
  });
});

describe("formatSynced", () => {
  const now = new Date("2026-10-30T12:00:00Z");

  it.each([
    [null, "Not synced yet"],
    ["2026-10-30T11:59:40Z", "Synced just now"],
    ["2026-10-30T11:59:00Z", "Synced 1 minute ago"],
    ["2026-10-30T11:15:00Z", "Synced 45 minutes ago"],
    ["2026-10-30T10:00:00Z", "Synced 2 hours ago"],
    ["2026-10-28T12:00:00Z", "Synced 2 days ago"],
  ])("formats %s", (lastSyncedAt, expected) => {
    expect(formatSynced(lastSyncedAt, now)).toBe(expected);
  });
});

describe("tallyGroups", () => {
  it("splits a count into groups of five plus a remainder", () => {
    expect(tallyGroups(0)).toEqual({ groups: 0, remainder: 0, overflow: 0 });
    expect(tallyGroups(4)).toEqual({ groups: 0, remainder: 4, overflow: 0 });
    expect(tallyGroups(12)).toEqual({ groups: 2, remainder: 2, overflow: 0 });
  });

  it("caps the drawing and reports what it left out", () => {
    expect(tallyGroups(53)).toEqual({ groups: 10, remainder: 0, overflow: 3 });
  });
});

describe("formatDay", () => {
  it("writes a day key as month and day without shifting time zones", () => {
    expect(formatDay("2026-10-11")).toBe("Oct 11");
    expect(formatDay("2026-01-01")).toBe("Jan 1");
  });
});
