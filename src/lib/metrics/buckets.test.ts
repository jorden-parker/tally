import { describe, expect, it } from "vitest";
import { countByBucket, dayKey, shiftDay, weekKey } from "./buckets";

describe("shiftDay", () => {
  it("moves a day key forward and backward across month ends", () => {
    expect(shiftDay("2026-10-30", 3)).toBe("2026-11-02");
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
  });
});

describe("dayKey", () => {
  it("uses the calendar day in the given time zone", () => {
    expect(dayKey("2026-10-30T02:00:00Z", "America/Los_Angeles")).toBe("2026-10-29");
    expect(dayKey("2026-10-30T02:00:00Z", "UTC")).toBe("2026-10-30");
  });
});

describe("weekKey", () => {
  it("returns the Monday that starts the week when weeks start on Monday", () => {
    expect(weekKey("2026-10-30T12:00:00Z", "UTC", 1)).toBe("2026-10-26");
  });

  it("returns the Sunday that starts the week when weeks start on Sunday", () => {
    expect(weekKey("2026-10-30T12:00:00Z", "UTC", 0)).toBe("2026-10-25");
  });

  it("keeps a Sunday in the week that began the previous Monday", () => {
    expect(weekKey("2026-11-01T12:00:00Z", "UTC", 1)).toBe("2026-10-26");
  });

  it("crosses a month boundary", () => {
    expect(weekKey("2026-11-03T12:00:00Z", "UTC", 1)).toBe("2026-11-02");
    expect(weekKey("2026-12-01T12:00:00Z", "UTC", 1)).toBe("2026-11-30");
  });

  it("buckets by the local day before finding the week", () => {
    expect(weekKey("2026-11-02T03:00:00Z", "America/Los_Angeles", 1)).toBe("2026-10-26");
  });
});

describe("countByBucket", () => {
  it("counts events per bucket in ascending order", () => {
    const events = [
      { occurredAt: "2026-10-30T10:00:00Z" },
      { occurredAt: "2026-10-28T10:00:00Z" },
      { occurredAt: "2026-10-30T15:00:00Z" },
    ];

    const counts = countByBucket(events, (event) => dayKey(event.occurredAt, "UTC"));

    expect(counts).toEqual([
      { key: "2026-10-28", count: 1 },
      { key: "2026-10-30", count: 2 },
    ]);
  });

  it("returns nothing for no events", () => {
    expect(countByBucket([], () => "unused")).toEqual([]);
  });
});
