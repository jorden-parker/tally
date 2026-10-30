import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";
import { fetchLogin, searchAll } from "./search";

type ReviewNode = { url: string; submittedAt: string | null };

type PullRequestNode = {
  title: string;
  url: string;
  repository: { nameWithOwner: string };
  reviews: { nodes: ReviewNode[] };
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
  const pullRequests = await searchAll<PullRequestNode>(run, QUERY, { search, login });
  return pullRequests.flatMap((pullRequest) => toEvents(pullRequest, `${sinceDate}T00:00:00Z`));
}
