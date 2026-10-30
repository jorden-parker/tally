import type { DatabaseSync } from "node:sqlite";
import type { Runner } from "@/lib/exec";
import { filterToAllowList, isAllowed } from "@/lib/github/allow-list";
import { fetchCreatedPrs, fetchMergedPrs, fetchOpenPrRepos } from "@/lib/github/pull-requests";
import { fetchReviewedPrs } from "@/lib/github/reviews";
import type { ShortcutGet } from "@/lib/shortcut/client";
import {
  countInProgressStories,
  fetchCompletedStories,
  fetchMentionName,
} from "@/lib/shortcut/stories";
import { upsertEvents, type EventSource } from "@/lib/store/events";
import { loadSettings, recordSnapshots, saveSettings } from "@/lib/store/settings";

export const SYNC_WINDOW_DAYS = 60;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type SyncDependencies = {
  db: DatabaseSync;
  run: Runner;
  shortcut: ShortcutGet | null;
  now: () => Date;
};

export type SyncResult = { errors: Partial<Record<EventSource, string>> };

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function syncGitHub(
  { db, run }: SyncDependencies,
  allowList: string[],
  now: Date,
): Promise<void> {
  const sinceDate = dayOf(daysFrom(now, -SYNC_WINDOW_DAYS));
  const [reviewed, created, merged, authoredRepos, requestedRepos] = await Promise.all([
    fetchReviewedPrs(run, sinceDate),
    fetchCreatedPrs(run, sinceDate),
    fetchMergedPrs(run, sinceDate),
    fetchOpenPrRepos(run, "authored"),
    fetchOpenPrRepos(run, "review-requested"),
  ]);
  upsertEvents(db, filterToAllowList([...reviewed, ...created, ...merged], allowList));
  recordSnapshots(
    db,
    {
      openAuthoredPrs: authoredRepos.filter((repo) => isAllowed(repo, allowList)).length,
      reviewRequestedPrs: requestedRepos.filter((repo) => isAllowed(repo, allowList)).length,
    },
    now.toISOString(),
  );
}

async function syncShortcut({ db }: SyncDependencies, get: ShortcutGet, now: Date): Promise<void> {
  const mentionName = await fetchMentionName(get);
  const window = {
    fromDay: dayOf(daysFrom(now, -SYNC_WINDOW_DAYS)),
    toDay: dayOf(daysFrom(now, 1)),
  };
  const completed = await fetchCompletedStories(get, mentionName, window);
  upsertEvents(db, completed);
  const storiesInProgress = await countInProgressStories(get, mentionName);
  recordSnapshots(db, { storiesInProgress }, now.toISOString());
}

async function capture(
  errors: SyncResult["errors"],
  source: EventSource,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    errors[source] = errorMessage(error);
  }
}

export async function syncAll(dependencies: SyncDependencies): Promise<SyncResult> {
  const { db, shortcut } = dependencies;
  const now = dependencies.now();
  const { allowList } = loadSettings(db);
  const errors: SyncResult["errors"] = {};

  await Promise.all([
    allowList.length > 0
      ? capture(errors, "github", () => syncGitHub(dependencies, allowList, now))
      : undefined,
    shortcut
      ? capture(errors, "shortcut", () => syncShortcut(dependencies, shortcut, now))
      : undefined,
  ]);

  if (Object.keys(errors).length === 0) saveSettings(db, { lastSyncedAt: now.toISOString() });
  return { errors };
}
