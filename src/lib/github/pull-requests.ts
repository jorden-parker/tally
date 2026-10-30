import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";

type SearchedPullRequest = {
  title: string;
  url: string;
  closedAt: string;
  createdAt: string;
  repository: { nameWithOwner: string };
};

export type OpenScope = "authored" | "review-requested";

const SEARCH_LIMIT = "100";

const SCOPE_FILTERS: Record<OpenScope, string[]> = {
  authored: ["--author", "@me"],
  "review-requested": ["--review-requested", "@me"],
};

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
  pullRequest: SearchedPullRequest,
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

export async function fetchMergedPrs(run: Runner, sinceDate: string): Promise<TallyEvent[]> {
  const merged = await searchPullRequests<SearchedPullRequest>(
    run,
    ["--author", "@me", "--merged", "--merged-at", `>=${sinceDate}`],
    "title,url,closedAt,repository",
  );
  return merged.map((pullRequest) => toEvent("pr_merged", pullRequest, pullRequest.closedAt));
}

export async function fetchCreatedPrs(run: Runner, sinceDate: string): Promise<TallyEvent[]> {
  const created = await searchPullRequests<SearchedPullRequest>(
    run,
    ["--author", "@me", "--created", `>=${sinceDate}`],
    "title,url,createdAt,repository",
  );
  return created.map((pullRequest) => toEvent("pr_created", pullRequest, pullRequest.createdAt));
}

export async function fetchOpenPrRepos(run: Runner, scope: OpenScope): Promise<string[]> {
  const open = await searchPullRequests<Pick<SearchedPullRequest, "repository">>(
    run,
    [...SCOPE_FILTERS[scope], "--state", "open"],
    "repository",
  );
  return open.map((pullRequest) => pullRequest.repository.nameWithOwner);
}
