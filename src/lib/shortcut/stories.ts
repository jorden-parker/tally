import type { Ticket, TicketPullRequest } from "@/lib/store/tickets";
import type { WorkItem } from "@/lib/store/work";
import type { ShortcutGet } from "./client";

export type DayWindow = { fromDay: string; toDay: string };

type StoryPullRequest = {
  url: string;
  title: string;
  draft: boolean;
  merged: boolean;
  closed: boolean;
};

type Story = {
  id: number;
  name: string;
  app_url: string;
  completed_at: string | null;
  created_at: string;
  workflow_state_id: number;
  started_at?: string | null;
  estimate?: number | null;
  story_type?: string;
  pull_requests?: StoryPullRequest[];
};

type Workflow = { states: { id: number; name: string }[] };

const WORKFLOWS_PATH = "/api/v3/workflows";
const UNKNOWN_STATE = "Unknown";

type StorySearchPage = {
  data: Story[];
  next: string | null;
  total?: number;
};

const SEARCH_PATH = "/api/v3/search/stories";
const PAGE_SIZE = 25;

function searchPath(query: string): string {
  return `${SEARCH_PATH}?query=${encodeURIComponent(query)}&page_size=${PAGE_SIZE}`;
}

async function searchAllStories(get: ShortcutGet, query: string): Promise<Story[]> {
  const stories: Story[] = [];
  let path: string | null = searchPath(query);
  while (path !== null) {
    const page: StorySearchPage = await get<StorySearchPage>(path);
    stories.push(...page.data);
    path = page.next;
  }
  return stories;
}

function toWorkItem(story: Story, completedAt: string): WorkItem {
  return {
    source: "shortcut",
    kind: "story_completed",
    externalId: String(story.id),
    occurredAt: completedAt,
    repo: null,
    title: story.name,
    url: story.app_url,
    startedAt: story.started_at ?? null,
    points: story.estimate ?? null,
    storyType: story.story_type ?? null,
    additions: null,
    deletions: null,
    changedFiles: null,
  };
}

export async function fetchMentionName(get: ShortcutGet): Promise<string> {
  const member = await get<{ mention_name: string }>("/api/v3/member");
  return member.mention_name;
}

export async function fetchCompletedStories(
  get: ShortcutGet,
  mentionName: string,
  window: DayWindow,
): Promise<WorkItem[]> {
  const stories = await searchAllStories(
    get,
    `owner:${mentionName} is:done completed:${window.fromDay}..${window.toDay}`,
  );
  return stories.flatMap((story) =>
    story.completed_at === null ? [] : [toWorkItem(story, story.completed_at)],
  );
}

export async function countInProgressStories(
  get: ShortcutGet,
  mentionName: string,
): Promise<number> {
  const page = await get<StorySearchPage>(searchPath(`owner:${mentionName} is:started !is:done`));
  return page.total ?? page.data.length;
}

export async function fetchWorkflowStateNames(get: ShortcutGet): Promise<Map<number, string>> {
  const workflows = await get<Workflow[]>(WORKFLOWS_PATH);
  return new Map(
    workflows.flatMap((workflow) => workflow.states.map((state) => [state.id, state.name])),
  );
}

function toTicketPullRequests(pullRequests: StoryPullRequest[]): TicketPullRequest[] {
  return pullRequests
    .filter((pullRequest) => pullRequest.merged || !pullRequest.closed)
    .map((pullRequest) => ({
      url: pullRequest.url,
      title: pullRequest.title,
      isDraft: pullRequest.draft,
      isMerged: pullRequest.merged,
    }));
}

function toTicket(story: Story, stateNames: Map<number, string>): Ticket {
  return {
    id: String(story.id),
    title: story.name,
    url: story.app_url,
    openedAt: story.created_at,
    storyType: story.story_type ?? null,
    state: stateNames.get(story.workflow_state_id) ?? UNKNOWN_STATE,
    estimate: story.estimate ?? null,
    pullRequests: toTicketPullRequests(story.pull_requests ?? []),
  };
}

export async function fetchAssignedStories(
  get: ShortcutGet,
  mentionName: string,
  stateNames: Map<number, string>,
): Promise<Ticket[]> {
  const stories = await searchAllStories(get, `owner:${mentionName} !is:done !is:archived`);
  return stories.map((story) => toTicket(story, stateNames));
}
