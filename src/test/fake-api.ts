import type { TallyApi } from "@/components/api";
import type { DailyPoint, DayRange, Summary } from "@/lib/metrics/summary";
import type { WorkReport, WorkRow } from "@/lib/metrics/work";
import type { TallyEvent } from "@/lib/store/events";
import type { OpenItem } from "@/lib/store/open-items";
import type { Settings } from "@/lib/store/settings";

export const FIXED_NOW = new Date("2026-10-30T12:00:00Z");

const DAY_MS = 24 * 60 * 60 * 1000;
const WORK_PERIOD = { from: "2026-10-01", to: "2026-10-30" };

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

function makeOpenItem(
  source: OpenItem["source"],
  title: string,
  repo: string | null = null,
): OpenItem {
  return {
    source,
    externalId: title,
    openedAt: "2026-10-20T10:00:00Z",
    isDraft: false,
    repo,
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
    open: {
      prs: [makeOpenItem("github", "Tidy the proxy", "acme/api")],
      tickets: [makeOpenItem("shortcut", "Plan the rollout")],
    },
    lastSyncedAt: "2026-10-30T11:55:00Z",
    ...overrides,
  };
}

export function makeWorkRow(kind: "pr_merged" | "story_completed", title: string): WorkRow {
  const isPullRequest = kind === "pr_merged";
  return {
    ...makeEvent(kind, title),
    day: "2026-10-29",
    startedAt: "2026-10-27T10:00:00Z",
    points: isPullRequest ? null : 3,
    storyType: isPullRequest ? null : "feature",
    additions: isPullRequest ? 120 : null,
    deletions: isPullRequest ? 30 : null,
    changedFiles: isPullRequest ? 4 : null,
  };
}

export function makeWorkReport(period: DayRange = WORK_PERIOD): WorkReport {
  const draft = makeOpenItem("github", "Tidy the proxy", "acme/api");
  return {
    ...period,
    totals: {
      prsMerged: 1,
      additions: 120,
      deletions: 30,
      changedFiles: 4,
      prsWithoutSize: 0,
      ticketsCompleted: 1,
      points: 3,
      unestimatedTickets: 0,
      ticketsByType: [{ key: "feature", count: 1 }],
      medianPrCycleMs: 2 * DAY_MS,
      medianTicketCycleMs: 2 * DAY_MS,
    },
    prs: [makeWorkRow("pr_merged", "Ship it")],
    tickets: [makeWorkRow("story_completed", "Ship tally")],
    drafts: [{ ...draft, isDraft: true, day: "2026-10-20" }],
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
    fetchWork: async (period) => makeWorkReport(period),
    fetchSettings: async () => makeSettings(),
    runSync: async () => ({ errors: {}, uncountedReviewRepos: [] }),
    saveSettings: async () => makeSettings(),
    ...overrides,
  };
}
