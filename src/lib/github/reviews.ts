import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";

type ReviewNode = { url: string; submittedAt: string | null };

type PullRequestNode = {
  title: string;
  url: string;
  repository: { nameWithOwner: string };
  reviews: { nodes: ReviewNode[] };
};

type SearchPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: PullRequestNode[];
};

const QUERY = `query($search: String!, $login: String!, $after: String) {
  search(query: $search, type: ISSUE, first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        title
        url
        repository { nameWithOwner }
        reviews(author: $login, first: 50) { nodes { url submittedAt } }
      }
    }
  }
}`;

async function fetchLogin(run: Runner): Promise<string> {
  const output = await run("gh", ["api", "user", "-q", ".login"]);
  return output.trim();
}

function buildArgs(search: string, login: string, after: string | null): string[] {
  const args = ["api", "graphql", "-f", `query=${QUERY}`, "-f", `search=${search}`];
  args.push("-f", `login=${login}`);
  return after === null ? args : [...args, "-f", `after=${after}`];
}

async function fetchPage(
  run: Runner,
  search: string,
  login: string,
  after: string | null,
): Promise<SearchPage> {
  const output = await run("gh", buildArgs(search, login, after));
  return JSON.parse(output).data.search;
}

async function fetchAllPullRequests(
  run: Runner,
  search: string,
  login: string,
): Promise<PullRequestNode[]> {
  const pullRequests: PullRequestNode[] = [];
  let after: string | null = null;
  do {
    const page: SearchPage = await fetchPage(run, search, login, after);
    pullRequests.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after !== null);
  return pullRequests;
}

function toEvents(pullRequest: PullRequestNode, sinceTimestamp: string): TallyEvent[] {
  return pullRequest.reviews.nodes.flatMap((review) =>
    review.submittedAt !== null && review.submittedAt >= sinceTimestamp
      ? [
          {
            source: "github",
            kind: "pr_reviewed",
            externalId: review.url,
            occurredAt: review.submittedAt,
            repo: pullRequest.repository.nameWithOwner,
            title: pullRequest.title,
            url: pullRequest.url,
          } satisfies TallyEvent,
        ]
      : [],
  );
}

export async function fetchReviewedPrs(run: Runner, sinceDate: string): Promise<TallyEvent[]> {
  const login = await fetchLogin(run);
  const search = `is:pr reviewed-by:${login} -author:${login} updated:>=${sinceDate}`;
  const pullRequests = await fetchAllPullRequests(run, search, login);
  return pullRequests.flatMap((pullRequest) => toEvents(pullRequest, `${sinceDate}T00:00:00Z`));
}
