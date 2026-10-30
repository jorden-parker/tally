import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "@/lib/store/database";
import { upsertEvents } from "@/lib/store/events";
import { replaceOpenItems } from "@/lib/store/open-items";
import { loadSettings, saveSettings } from "@/lib/store/settings";
import { upsertWorkDetails, type WorkItem } from "@/lib/store/work";
import { createServices, InvalidSettingsError, parseDayRange, type Services } from "./services";
import type { ShortcutGet } from "@/lib/shortcut/client";

const NOW = new Date("2026-10-30T12:00:00Z");

const emptyShortcut: ShortcutGet = async <T>() =>
  ({ mention_name: "jorden", data: [], next: null }) as T;

function services(db: DatabaseSync): Services {
  return createServices({
    db,
    run: async () => {
      throw new Error("gh must not run in this test");
    },
    shortcut: emptyShortcut,
    now: () => NOW,
  });
}

describe("parseDayRange", () => {
  it("accepts a real, ordered pair of days", () => {
    expect(parseDayRange("2026-10-01", "2026-10-30")).toEqual({
      from: "2026-10-01",
      to: "2026-10-30",
    });
  });

  it("accepts a single day", () => {
    expect(parseDayRange("2026-10-01", "2026-10-01")).not.toBeNull();
  });

  it.each([
    [null, "2026-10-30"],
    ["2026-10-01", null],
    ["yesterday", "2026-10-30"],
    ["2026-02-31", "2026-03-01"],
    ["2026-10-30", "2026-10-01"],
  ])("rejects %s to %s", (from, to) => {
    expect(parseDayRange(from, to)).toBeNull();
  });
});

describe("services", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
    saveSettings(db, { allowList: ["acme"], timeZone: "UTC" });
  });

  it("summarises stored events with the saved settings", () => {
    upsertEvents(db, [
      {
        source: "github",
        kind: "pr_created",
        externalId: "pr-1",
        occurredAt: "2026-10-30T08:00:00Z",
        repo: "acme/api",
        title: "Add retries",
        url: "pr-1",
      },
    ]);

    const summary = services(db).summary("day");

    expect(summary.current.created).toBe(1);
    expect(summary.range).toBe("day");
  });

  it("includes the stored open PRs and assigned tickets in the summary", () => {
    replaceOpenItems(db, "github", [
      {
        source: "github",
        externalId: "https://github.com/acme/api/pull/3",
        openedAt: "2026-10-20T08:00:00Z",
        isDraft: false,
        repo: "acme/api",
        title: "Add retries",
        url: "https://github.com/acme/api/pull/3",
      },
    ]);
    replaceOpenItems(db, "shortcut", [
      {
        source: "shortcut",
        externalId: "31",
        openedAt: "2026-10-10T09:00:00Z",
        isDraft: false,
        repo: null,
        title: "Plan the rollout",
        url: "https://app.shortcut.com/acme/story/31",
      },
    ]);

    const summary = services(db).summary("day");

    expect(summary.open.prs.map((item) => item.title)).toEqual(["Add retries"]);
    expect(summary.open.tickets.map((item) => item.title)).toEqual(["Plan the rollout"]);
  });

  describe("work", () => {
    function mergedPr(occurredAt: string): WorkItem {
      return {
        source: "github",
        kind: "pr_merged",
        externalId: occurredAt,
        occurredAt,
        repo: "acme/api",
        title: "Ship it",
        url: "https://github.com/acme/api/pull/4",
        startedAt: null,
        points: null,
        storyType: null,
        additions: 10,
        deletions: 2,
        changedFiles: 1,
      };
    }

    function store(...items: WorkItem[]) {
      upsertEvents(db, items);
      upsertWorkDetails(db, items);
    }

    it("reports work older than the sync window", () => {
      store(mergedPr("2025-03-10T10:00:00Z"));

      const report = services(db).work({ from: "2025-03-01", to: "2025-03-31" });

      expect(report.totals.additions).toBe(10);
    });

    it("includes the whole last day in a time zone behind UTC", () => {
      saveSettings(db, { timeZone: "America/New_York" });
      store(mergedPr("2026-11-01T03:00:00Z"));

      const report = services(db).work({ from: "2026-10-31", to: "2026-10-31" });

      expect(report.prs).toHaveLength(1);
    });

    it("includes the whole first day in a time zone ahead of UTC", () => {
      saveSettings(db, { timeZone: "Pacific/Auckland" });
      store(mergedPr("2026-09-30T20:00:00Z"));

      const report = services(db).work({ from: "2026-10-01", to: "2026-10-01" });

      expect(report.prs).toHaveLength(1);
    });
  });

  it("syncs through the sync module and stamps the time", async () => {
    saveSettings(db, { allowList: [] });

    const result = await services(db).sync();

    expect(result.errors).toEqual({});
    expect(loadSettings(db).lastSyncedAt).toBe(NOW.toISOString());
  });

  it("saves valid settings, trimming and dropping blank allow-list entries", () => {
    const view = services(db).updateSettings({
      allowList: [" acme ", "", "me/side-project"],
      weekStart: 0,
      timeZone: "America/Los_Angeles",
    });

    expect(view.allowList).toEqual(["acme", "me/side-project"]);
    expect(loadSettings(db)).toMatchObject({
      allowList: ["acme", "me/side-project"],
      weekStart: 0,
      timeZone: "America/Los_Angeles",
    });
  });

  it.each([
    ["a bad week start", { weekStart: 3 }],
    ["an owner with a space", { allowList: ["not valid"] }],
    ["an unknown time zone", { timeZone: "Mars/Olympus" }],
    ["an unknown key", { lastSyncedAt: "2020-01-01T00:00:00Z" }],
  ])("rejects %s", (_name, body) => {
    expect(() => services(db).updateSettings(body)).toThrow(InvalidSettingsError);
  });
});
