import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";
import type { OpenItem } from "@/lib/store/open-items";
import type { WorkItem } from "@/lib/store/work";
import { fetchLogin, searchAll } from "./search";

type SearchedPullRequest = {
  title: string;
  url: string;
  createdAt: string;
  isDraft: boolean;
  repository: { nameWithOwner: string };
};

type MergedPullRequest = Omit<SearchedPullRequest, "isDraft"> & {
  mergedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
};

const SEARCH_LIMIT = "100";

const MERGED_QUERY = `query($search: String!, $after: String) {
  search(query: $search, type: ISSUE, first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        title
        url
        createdAt
        mergedAt
        additions
        deletions
        changedFiles
        repository { nameWithOwner }
      }
    }
  }
}`;

async function searchPullRequests<T>(run: Runner, filters: string[], fields: string): Promise<T[]> {
  const output = await run("gh", [
    "search",
    "prs",
    ...filters,
    "--json",
    fields,
    "--limit",
    SEARCH_LIMIT,
  ]);
  return JSON.parse(output);
}

function toEvent(
  kind: TallyEvent["kind"],
  pullRequest: Pick<SearchedPullRequest, "title" | "url" | "repository">,
  occurredAt: string,
): TallyEvent {
  return {
    source: "github",
    kind,
    externalId: pullRequest.url,
    occurredAt,
    repo: pullRequest.repository.nameWithOwner,
    title: pullRequest.title,
    url: pullRequest.url,
  };
}

function toWorkItem(pullRequest: MergedPullRequest): WorkItem {
  return {
    ...toEvent("pr_merged", pullRequest, pullRequest.mergedAt),
    startedAt: pullRequest.createdAt,
    points: null,
    storyType: null,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    changedFiles: pullRequest.changedFiles,
  };
}

export async function fetchMergedPrs(run: Runner, sinceDate: string): Promise<WorkItem[]> {
  const login = await fetchLogin(run);
  const search = `is:pr author:${login} is:merged merged:>=${sinceDate}`;
  const merged = await searchAll<MergedPullRequest>(run, MERGED_QUERY, { search });
  return merged.map(toWorkItem);
}

export async function fetchCreatedPrs(run: Runner, sinceDate: string): Promise<TallyEvent[]> {
  const created = await searchPullRequests<SearchedPullRequest>(
    run,
    ["--author", "@me", "--created", `>=${sinceDate}`],
    "title,url,createdAt,repository",
  );
  return created.map((pullRequest) => toEvent("pr_created", pullRequest, pullRequest.createdAt));
}

export async function fetchOpenAuthoredPrs(run: Runner): Promise<OpenItem[]> {
  const open = await searchPullRequests<SearchedPullRequest>(
    run,
    ["--author", "@me", "--state", "open"],
    "title,url,createdAt,isDraft,repository",
  );
  return open.map((pullRequest) => ({
    source: "github",
    externalId: pullRequest.url,
    openedAt: pullRequest.createdAt,
    isDraft: pullRequest.isDraft,
    repo: pullRequest.repository.nameWithOwner,
    title: pullRequest.title,
    url: pullRequest.url,
  }));
}

export async function fetchReviewRequestedRepos(run: Runner): Promise<string[]> {
  const open = await searchPullRequests<Pick<SearchedPullRequest, "repository">>(
    run,
    ["--review-requested", "@me", "--state", "open"],
    "repository",
  );
  return open.map((pullRequest) => pullRequest.repository.nameWithOwner);
}
