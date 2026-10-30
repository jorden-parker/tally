import type { Runner } from "@/lib/exec";

type SearchPage<T> = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: T[];
};

export async function fetchLogin(run: Runner): Promise<string> {
  const output = await run("gh", ["api", "user", "-q", ".login"]);
  return output.trim();
}

function buildArgs(
  query: string,
  variables: Record<string, string>,
  after: string | null,
): string[] {
  const fields = after === null ? variables : { ...variables, after };
  const args = Object.entries(fields).flatMap(([name, value]) => ["-f", `${name}=${value}`]);
  return ["api", "graphql", "-f", `query=${query}`, ...args];
}

async function fetchPage<T>(
  run: Runner,
  query: string,
  variables: Record<string, string>,
  after: string | null,
): Promise<SearchPage<T>> {
  const output = await run("gh", buildArgs(query, variables, after));
  return JSON.parse(output).data.search;
}

export async function searchAll<T>(
  run: Runner,
  query: string,
  variables: Record<string, string>,
): Promise<T[]> {
  const nodes: T[] = [];
  let after: string | null = null;
  do {
    const page: SearchPage<T> = await fetchPage<T>(run, query, variables, after);
    nodes.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after !== null);
  return nodes;
}
