import type { AssignedStory, WorkflowStateType } from "@/lib/store/assigned-stories";
import type { Ticket, TicketPullRequest, TicketRole } from "@/lib/store/tickets";
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

export type Story = {
  id: number;
  name: string;
  app_url: string;
  completed_at: string | null;
  created_at: string;
  workflow_state_id: number;
  started_at?: string | null;
  estimate?: number | null;
  story_type?: string;
  owner_ids?: string[];
  pull_requests?: StoryPullRequest[];
};

export type CompletedStory = Story & { completed_at: string };

export type WorkflowState = { name: string; type: WorkflowStateType; position: number };

export type WorkflowStates = Map<number, WorkflowState>;

export type StoryContext = {
  states: WorkflowStates;
  memberNames: Map<string, string>;
};

type Workflow = { states: (WorkflowState & { id: number })[] };

type Member = { id: string; profile: { name: string } };

const WORKFLOWS_PATH = "/api/v3/workflows";
const MEMBERS_PATH = "/api/v3/members";
const STORIES_PATH = "/api/v3/stories";
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

function isCompleted(story: Story): story is CompletedStory {
  return story.completed_at !== null;
}

export function toWorkItem(story: CompletedStory): WorkItem {
  return {
    source: "shortcut",
    kind: "story_completed",
    externalId: String(story.id),
    occurredAt: story.completed_at,
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

export async function fetchMemberNames(get: ShortcutGet): Promise<Map<string, string>> {
  const members = await get<Member[]>(MEMBERS_PATH);
  return new Map(members.map((member) => [member.id, member.profile.name]));
}

export async function fetchCompletedStories(
  get: ShortcutGet,
  mentionName: string,
  window: DayWindow,
): Promise<CompletedStory[]> {
  const stories = await searchAllStories(
    get,
    `owner:${mentionName} is:done completed:${window.fromDay}..${window.toDay}`,
  );
  return stories.filter(isCompleted);
}

export async function countInProgressStories(
  get: ShortcutGet,
  mentionName: string,
): Promise<number> {
  const page = await get<StorySearchPage>(searchPath(`owner:${mentionName} is:started !is:done`));
  return page.total ?? page.data.length;
}

export async function fetchWorkflowStates(get: ShortcutGet): Promise<WorkflowStates> {
  const workflows = await get<Workflow[]>(WORKFLOWS_PATH);
  return new Map(
    workflows.flatMap((workflow) =>
      workflow.states.map(({ id, name, type, position }) => [id, { name, type, position }]),
    ),
  );
}

export function isOpenStory(story: Story, states: WorkflowStates): boolean {
  return states.get(story.workflow_state_id)?.type !== "done";
}

export function toAssignedStory(story: Story, states: WorkflowStates): AssignedStory {
  const state = states.get(story.workflow_state_id);
  return {
    id: String(story.id),
    title: story.name,
    url: story.app_url,
    openedAt: story.created_at,
    completedAt: story.completed_at,
    storyType: story.story_type ?? null,
    estimate: story.estimate ?? null,
    state: state?.name ?? UNKNOWN_STATE,
    stateType: state?.type ?? null,
    statePosition: state?.position ?? null,
  };
}

function toTicketPullRequests(pullRequests: StoryPullRequest[]): TicketPullRequest[] {
  return pullRequests
    .filter((pullRequest) => pullRequest.merged || !pullRequest.closed)
    .map((pullRequest) => ({
      url: pullRequest.url,
      title: pullRequest.title,
      isDraft: pullRequest.draft,
      isMerged: pullRequest.merged,
      reviewStatus: null,
    }));
}

function ownerNames(ownerIds: string[], memberNames: Map<string, string>): string[] {
  return ownerIds.flatMap((id) => {
    const name = memberNames.get(id);
    return name === undefined ? [] : [name];
  });
}

export function toTicket(story: Story, role: TicketRole, context: StoryContext): Ticket {
  return {
    id: String(story.id),
    title: story.name,
    url: story.app_url,
    openedAt: story.created_at,
    storyType: story.story_type ?? null,
    state: context.states.get(story.workflow_state_id)?.name ?? UNKNOWN_STATE,
    estimate: story.estimate ?? null,
    role,
    completedAt: story.completed_at,
    owners: ownerNames(story.owner_ids ?? [], context.memberNames),
    pullRequests: toTicketPullRequests(story.pull_requests ?? []),
  };
}

export async function fetchOwnedStories(get: ShortcutGet, mentionName: string): Promise<Story[]> {
  return searchAllStories(get, `owner:${mentionName} !is:archived`);
}

export async function fetchStoriesById(
  get: ShortcutGet,
  ids: string[],
  context: StoryContext,
): Promise<Ticket[]> {
  const results = await Promise.allSettled(ids.map((id) => get<Story>(`${STORIES_PATH}/${id}`)));
  return results.flatMap((result) =>
    result.status === "fulfilled" ? [toTicket(result.value, "reviewing", context)] : [],
  );
}
