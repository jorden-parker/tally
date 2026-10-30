import type { TallyEvent } from "@/lib/store/events";

export function isAllowed(repo: string, allowList: string[]): boolean {
  const target = repo.toLowerCase();
  return allowList.some((entry) => {
    const allowed = entry.toLowerCase();
    return allowed.includes("/") ? target === allowed : target.startsWith(`${allowed}/`);
  });
}

export function filterToAllowList(events: TallyEvent[], allowList: string[]): TallyEvent[] {
  return events.filter((event) => event.repo !== null && isAllowed(event.repo, allowList));
}

export function uncountedRepos(events: TallyEvent[], allowList: string[]): string[] {
  const repos = events.flatMap((event) =>
    event.repo !== null && !isAllowed(event.repo, allowList) ? [event.repo] : [],
  );
  return [...new Set(repos)].sort();
}
