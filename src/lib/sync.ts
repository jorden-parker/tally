import type { DatabaseSync } from "node:sqlite";
import type { Runner } from "@/lib/exec";
import { filterToAllowList, uncountedRepos } from "@/lib/github/allow-list";
import {
  fetchCreatedPrs,
  fetchMergedPrs,
  fetchOpenAuthoredPrs,
  fetchPullRequestsToReview,
  type ReviewablePullRequest,
} from "@/lib/github/pull-requests";
import { fetchReviewedPrs } from "@/lib/github/reviews";
import type { ShortcutGet } from "@/lib/shortcut/client";
import { linkPullRequests } from "@/lib/shortcut/link";
import {
  countInProgressStories,
  fetchAssignedStories,
  fetchCompletedStories,
  fetchMemberNames,
  fetchMentionName,
  fetchStoriesById,
  fetchWorkflowStateNames,
  toTicket,
  toWorkItem,
  type StoryContext,
} from "@/lib/shortcut/stories";
import { storyIdsIn } from "@/lib/shortcut/story-refs";
import { upsertEvents, type EventSource } from "@/lib/store/events";
import { replaceOpenItems } from "@/lib/store/open-items";
import { replacePullRequestReviews } from "@/lib/store/pull-request-reviews";
import { loadSettings, recordSnapshots, saveSettings } from "@/lib/store/settings";
import { replaceTickets, type Ticket } from "@/lib/store/tickets";
import { upsertWorkDetails } from "@/lib/store/work";

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

type GitHubSync = { authored: ReviewablePullRequest[]; toReview: ReviewablePullRequest[] };

type ShortcutSync = { assigned: Ticket[]; completed: Ticket[]; context: StoryContext };

const NO_PULL_REQUESTS: GitHubSync = { authored: [], toReview: [] };

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
  result: SyncResult,
  now: Date,
): Promise<GitHubSync> {
  const sinceDate = dayOf(daysFrom(now, -SYNC_WINDOW_DAYS));
  const results = await Promise.allSettled([
    fetchReviewedPrs(run, sinceDate),
    fetchCreatedPrs(run, sinceDate),
    fetchMergedPrs(run, sinceDate),
    fetchOpenAuthoredPrs(run),
    fetchPullRequestsToReview(run),
  ]);
  const [reviewed, created, merged, openAuthored, toReview] = results;
  const reviews = settledValue(reviewed, []);
  const mergedPrs = filterToAllowList(settledValue(merged, []), allowList);
  upsertEvents(db, [
    ...filterToAllowList([...reviews, ...settledValue(created, [])], allowList),
    ...mergedPrs,
  ]);
  upsertWorkDetails(db, mergedPrs);
  result.uncountedReviewRepos.push(...uncountedRepos(reviews, allowList));
  if (openAuthored.status === "fulfilled") {
    const openPrs = filterToAllowList(openAuthored.value, allowList);
    replaceOpenItems(db, "github", openPrs);
    recordSnapshots(db, { openAuthoredPrs: openPrs.length }, now.toISOString());
  }
  if (toReview.status === "fulfilled") {
    const allowedPrs = filterToAllowList(toReview.value, allowList);
    recordSnapshots(db, { reviewRequestedPrs: allowedPrs.length }, now.toISOString());
  }
  const pullRequests = {
    authored: settledValue(openAuthored, []),
    toReview: settledValue(toReview, []),
  };
  replacePullRequestReviews(
    db,
    [...pullRequests.authored, ...pullRequests.toReview].flatMap((pullRequest) =>
      pullRequest.reviewStatus === null
        ? []
        : [{ url: pullRequest.url, status: pullRequest.reviewStatus }],
    ),
  );
  const failure = results.find((settled) => settled.status === "rejected");
  if (failure) result.errors.github = errorMessage(failure.reason);
  return pullRequests;
}

async function syncShortcut(
  { db }: SyncDependencies,
  get: ShortcutGet,
  now: Date,
): Promise<ShortcutSync> {
  const mentionName = await fetchMentionName(get);
  const window = {
    fromDay: dayOf(daysFrom(now, -SYNC_WINDOW_DAYS)),
    toDay: dayOf(daysFrom(now, 1)),
  };
  const completedStories = await fetchCompletedStories(get, mentionName, window);
  const completedWork = completedStories.map(toWorkItem);
  upsertEvents(db, completedWork);
  upsertWorkDetails(db, completedWork);
  const storiesInProgress = await countInProgressStories(get, mentionName);
  recordSnapshots(db, { storiesInProgress }, now.toISOString());
  const context = {
    stateNames: await fetchWorkflowStateNames(get),
    memberNames: await fetchMemberNames(get),
  };
  return {
    assigned: await fetchAssignedStories(get, mentionName, context),
    completed: completedStories.map((story) => toTicket(story, "completed", context)),
    context,
  };
}

function storyIdsToReview(toReview: ReviewablePullRequest[], known: Ticket[]): string[] {
  const knownIds = new Set(known.map((ticket) => ticket.id));
  const mentioned = toReview.flatMap((pullRequest) =>
    storyIdsIn(`${pullRequest.headRefName} ${pullRequest.title}`),
  );
  return [...new Set(mentioned)].filter((id) => !knownIds.has(id));
}

async function storeTickets(
  { db, shortcut }: SyncDependencies,
  { assigned, completed, context }: ShortcutSync,
  { authored, toReview }: GitHubSync,
): Promise<void> {
  const known = [...assigned, ...completed];
  const reviewing = await fetchStoriesById(shortcut, storyIdsToReview(toReview, known), context);
  const tickets = [...assigned, ...reviewing, ...completed];
  replaceTickets(db, linkPullRequests(tickets, [...authored, ...toReview]));
}

async function capture<T>(
  errors: SyncResult["errors"],
  source: EventSource,
  work: () => Promise<T>,
): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    errors[source] = errorMessage(error);
    return null;
  }
}

export async function syncAll(dependencies: SyncDependencies): Promise<SyncResult> {
  const { db, shortcut } = dependencies;
  const now = dependencies.now();
  const { allowList } = loadSettings(db);
  const result: SyncResult = { errors: {}, uncountedReviewRepos: [] };

  const [github, stories] = await Promise.all([
    allowList.length > 0
      ? capture(result.errors, "github", () => syncGitHub(dependencies, allowList, result, now))
      : null,
    capture(result.errors, "shortcut", () => syncShortcut(dependencies, shortcut, now)),
  ]);
  if (stories !== null) {
    await capture(result.errors, "shortcut", () =>
      storeTickets(dependencies, stories, github ?? NO_PULL_REQUESTS),
    );
  }

  if (Object.keys(result.errors).length === 0) {
    saveSettings(db, { lastSyncedAt: now.toISOString() });
  }
  return result;
}
