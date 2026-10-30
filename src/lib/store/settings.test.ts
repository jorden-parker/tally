import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./database";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadSnapshots,
  recordSnapshots,
  saveSettings,
} from "./settings";

describe("settings", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("starts with the defaults", () => {
    expect(loadSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it("persists a partial update and keeps the rest", () => {
    saveSettings(db, { allowList: ["acme", "me/side-project"] });
    saveSettings(db, { weekStart: 0 });

    expect(loadSettings(db)).toEqual({
      ...DEFAULT_SETTINGS,
      allowList: ["acme", "me/side-project"],
      weekStart: 0,
    });
  });

  it("falls back to the default for a corrupt value", () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('allowList', 'not json')").run();

    expect(loadSettings(db).allowList).toEqual(DEFAULT_SETTINGS.allowList);
  });
});

describe("snapshots", () => {
  it("keeps only the latest value per key", () => {
    const db = openDatabase(":memory:");

    recordSnapshots(db, { storiesInProgress: 3 }, "2026-10-29T09:00:00Z");
    recordSnapshots(db, { storiesInProgress: 2, openAuthoredPrs: 4 }, "2026-10-30T09:00:00Z");

    expect(loadSnapshots(db)).toEqual({ storiesInProgress: 2, openAuthoredPrs: 4 });
  });
});
