import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";

export type TimeWindow = { from: string; to: string };

type PullRequestNode = {
  title: string;
  url: string;
  repository: { nameWithOwner: string };
};

type ContributionNode = {
  occurredAt: string;
  pullRequest: PullRequestNode;
  pullRequestReview?: { url: string };
};

type ContributionPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: ContributionNode[];
};

const PULL_REQUEST_FIELDS = "pullRequest { title url repository { nameWithOwner } }";

const REVIEWS = {
  connection: "pullRequestReviewContributions",
  fields: `occurredAt pullRequestReview { url } ${PULL_REQUEST_FIELDS}`,
};

const CREATED = {
  connection: "pullRequestContributions",
  fields: `occurredAt ${PULL_REQUEST_FIELDS}`,
};

type ContributionQuery = typeof REVIEWS;

function buildQuery({ connection, fields }: ContributionQuery): string {
  return `query($from: DateTime!, $to: DateTime!, $after: String) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        ${connection}(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${fields} }
        }
      }
    }
  }`;
}

function buildArgs(query: string, window: TimeWindow, after: string | null): string[] {
  const args = ["api", "graphql", "-f", `query=${query}`];
  args.push("-f", `from=${window.from}`, "-f", `to=${window.to}`);
  return after === null ? args : [...args, "-f", `after=${after}`];
}

async function fetchPage(
  run: Runner,
  query: ContributionQuery,
  window: TimeWindow,
  after: string | null,
): Promise<ContributionPage> {
  const output = await run("gh", buildArgs(buildQuery(query), window, after));
  const response = JSON.parse(output);
  return response.data.viewer.contributionsCollection[query.connection];
}

async function fetchAllNodes(
  run: Runner,
  query: ContributionQuery,
  window: TimeWindow,
): Promise<ContributionNode[]> {
  const nodes: ContributionNode[] = [];
  let after: string | null = null;
  do {
    const page: ContributionPage = await fetchPage(run, query, window, after);
    nodes.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after !== null);
  return nodes;
}

function toEvent(kind: TallyEvent["kind"], node: ContributionNode, externalId: string): TallyEvent {
  return {
    source: "github",
    kind,
    externalId,
    occurredAt: node.occurredAt,
    repo: node.pullRequest.repository.nameWithOwner,
    title: node.pullRequest.title,
    url: node.pullRequest.url,
  };
}

export async function fetchReviewedPrs(run: Runner, window: TimeWindow): Promise<TallyEvent[]> {
  const nodes = await fetchAllNodes(run, REVIEWS, window);
  return nodes.map((node) =>
    toEvent("pr_reviewed", node, node.pullRequestReview?.url ?? node.pullRequest.url),
  );
}

export async function fetchCreatedPrs(run: Runner, window: TimeWindow): Promise<TallyEvent[]> {
  const nodes = await fetchAllNodes(run, CREATED, window);
  return nodes.map((node) => toEvent("pr_created", node, node.pullRequest.url));
}
