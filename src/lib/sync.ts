import type { DatabaseSync } from "node:sqlite";
import type { Runner } from "@/lib/exec";
import { filterToAllowList, isAllowed, uncountedRepos } from "@/lib/github/allow-list";
import {
  fetchCreatedPrs,
  fetchMergedPrs,
  fetchOpenAuthoredPrs,
  fetchReviewRequestedRepos,
} from "@/lib/github/pull-requests";
import { fetchReviewedPrs } from "@/lib/github/reviews";
import type { ShortcutGet } from "@/lib/shortcut/client";
import {
  countInProgressStories,
  fetchCompletedStories,
  fetchMentionName,
} from "@/lib/shortcut/stories";
import { upsertEvents, type EventSource } from "@/lib/store/events";
import { replaceOpenItems } from "@/lib/store/open-items";
import { loadSettings, recordSnapshots, saveSettings } from "@/lib/store/settings";

export const SYNC_WINDOW_DAYS = 60;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type SyncDependencies = {
  db: DatabaseSync;
  run: Runner;
  shortcut: ShortcutGet;
  now: () => Date;
};

export type SyncResult = {
  errors: Partial<Record<EventSource, string>>;
  uncountedReviewRepos: string[];
};

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

async function syncGitHub(
  { db, run }: SyncDependencies,
  allowList: string[],
  uncountedReviewRepos: string[],
  now: Date,
): Promise<void> {
  const sinceDate = dayOf(daysFrom(now, -SYNC_WINDOW_DAYS));
  const results = await Promise.allSettled([
    fetchReviewedPrs(run, sinceDate),
    fetchCreatedPrs(run, sinceDate),
    fetchMergedPrs(run, sinceDate),
    fetchOpenAuthoredPrs(run),
    fetchReviewRequestedRepos(run),
  ]);
  const [reviewed, created, merged, openAuthored, requestedRepos] = results;
  const reviews = settledValue(reviewed, []);
  upsertEvents(
    db,
    filterToAllowList(
      [...reviews, ...settledValue(created, []), ...settledValue(merged, [])],
      allowList,
    ),
  );
  uncountedReviewRepos.push(...uncountedRepos(reviews, allowList));
  if (openAuthored.status === "fulfilled") {
    const openPrs = filterToAllowList(openAuthored.value, allowList);
    replaceOpenItems(db, "github", openPrs);
    recordSnapshots(db, { openAuthoredPrs: openPrs.length }, now.toISOString());
  }
  if (requestedRepos.status === "fulfilled") {
    const allowedRepos = requestedRepos.value.filter((repo) => isAllowed(repo, allowList));
    recordSnapshots(db, { reviewRequestedPrs: allowedRepos.length }, now.toISOString());
  }
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
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
  const uncountedReviewRepos: string[] = [];

  await Promise.all([
    allowList.length > 0
      ? capture(errors, "github", () =>
          syncGitHub(dependencies, allowList, uncountedReviewRepos, now),
        )
      : undefined,
    capture(errors, "shortcut", () => syncShortcut(dependencies, shortcut, now)),
  ]);

  if (Object.keys(errors).length === 0) saveSettings(db, { lastSyncedAt: now.toISOString() });
  return { errors, uncountedReviewRepos };
}
