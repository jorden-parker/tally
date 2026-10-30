import type { TallyApi } from "@/components/api";
import type { DailyPoint, Summary } from "@/lib/metrics/summary";
import type { TallyEvent } from "@/lib/store/events";
import type { Settings } from "@/lib/store/settings";

export const FIXED_NOW = new Date("2026-10-30T12:00:00Z");

export function makeEvent(kind: TallyEvent["kind"], title: string, repo = "acme/api"): TallyEvent {
  return {
    source: kind === "story_completed" ? "shortcut" : "github",
    kind,
    externalId: title,
    occurredAt: "2026-10-29T10:00:00Z",
    repo: kind === "story_completed" ? null : repo,
    title,
    url: `https://example.test/${encodeURIComponent(title)}`,
  };
}

function dailyPoints(): DailyPoint[] {
  return Array.from({ length: 28 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 9, 3 + index)).toISOString().slice(0, 10);
    return { day, reviewed: index % 5, created: index % 3 };
  });
}

export function makeSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    range: "week",
    current: { reviewed: 7, created: 3, merged: 2, completed: 4 },
    previous: { reviewed: 4, created: 3, merged: 0, completed: 5 },
    now: { openAuthoredPrs: 2, reviewRequestedPrs: 1, storiesInProgress: 3 },
    daily: dailyPoints(),
    lists: {
      reviewed: [makeEvent("pr_reviewed", "Add retries")],
      created: [makeEvent("pr_created", "Fix flaky test")],
      merged: [],
      completed: [makeEvent("story_completed", "Ship the tracker")],
    },
    lastSyncedAt: "2026-10-30T11:55:00Z",
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    allowList: ["acme"],
    weekStart: 1,
    timeZone: "UTC",
    lastSyncedAt: "2026-10-30T11:55:00Z",
    ...overrides,
  };
}

export function fakeApi(overrides: Partial<TallyApi> = {}): TallyApi {
  return {
    fetchSummary: async (range) => makeSummary({ range }),
    fetchSettings: async () => makeSettings(),
    runSync: async () => ({ errors: {}, uncountedReviewRepos: [] }),
    saveSettings: async () => makeSettings(),
    ...overrides,
  };
}
