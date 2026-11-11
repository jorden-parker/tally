import {
  WORKFLOW_STATE_TYPES,
  type AssignedStory,
  type WorkflowStateType,
} from "@/lib/store/assigned-stories";

export type StatusGrouping = "state" | "type" | "none";

export type StatusOption = { type: WorkflowStateType | null; label: string; states: string[] };

export type StoryGroup = { key: string; label: string; stories: AssignedStory[] };

const STATE_TYPE_LABELS: Record<WorkflowStateType, string> = {
  backlog: "Backlog",
  unstarted: "Unstarted",
  started: "Started",
  done: "Done",
};

export const ALL_STATUSES = "all";

const TYPE_PREFIX = "type:";
const STATE_PREFIX = "state:";
const OTHER_TYPE_LABEL = "Other";
const UNGROUPED_LABEL = "All tickets";

export function filterForType(type: WorkflowStateType): string {
  return `${TYPE_PREFIX}${type}`;
}

export function filterForState(state: string): string {
  return `${STATE_PREFIX}${state}`;
}

function labelForType(type: WorkflowStateType | null): string {
  return type === null ? OTHER_TYPE_LABEL : STATE_TYPE_LABELS[type];
}

function rankOfType(type: WorkflowStateType | null): number {
  return type === null ? WORKFLOW_STATE_TYPES.length : WORKFLOW_STATE_TYPES.indexOf(type);
}

function compareWorkflowOrder(first: AssignedStory, second: AssignedStory): number {
  return (
    rankOfType(first.stateType) - rankOfType(second.stateType) ||
    (first.statePosition ?? Infinity) - (second.statePosition ?? Infinity) ||
    first.state.localeCompare(second.state)
  );
}

function groupBy(
  stories: AssignedStory[],
  keyOf: (story: AssignedStory) => string,
  labelOf: (story: AssignedStory) => string,
): StoryGroup[] {
  const ordered = [...stories].sort(compareWorkflowOrder);
  const groups = new Map<string, StoryGroup>();
  for (const story of ordered) {
    const key = keyOf(story);
    const group = groups.get(key) ?? { key, label: labelOf(story), stories: [] };
    groups.set(key, group);
  }
  for (const story of stories) groups.get(keyOf(story))?.stories.push(story);
  return [...groups.values()];
}

function typeKeyOf(story: AssignedStory): string {
  return story.stateType ?? OTHER_TYPE_LABEL;
}

export function listStatusOptions(stories: AssignedStory[]): StatusOption[] {
  return groupBy(stories, typeKeyOf, (story) => labelForType(story.stateType)).map((group) => ({
    type: group.stories[0].stateType,
    label: group.label,
    states: groupBy(
      group.stories,
      (story) => story.state,
      (story) => story.state,
    ).map((stateGroup) => stateGroup.label),
  }));
}

export function filterByStatus(stories: AssignedStory[], filter: string): AssignedStory[] {
  if (filter.startsWith(TYPE_PREFIX)) {
    const type = filter.slice(TYPE_PREFIX.length);
    return stories.filter((story) => story.stateType === type);
  }
  if (filter.startsWith(STATE_PREFIX)) {
    const state = filter.slice(STATE_PREFIX.length);
    return stories.filter((story) => story.state === state);
  }
  return stories;
}

export function groupByStatus(stories: AssignedStory[], grouping: StatusGrouping): StoryGroup[] {
  if (grouping === "state")
    return groupBy(
      stories,
      (story) => story.state,
      (story) => story.state,
    );
  if (grouping === "type")
    return groupBy(stories, typeKeyOf, (story) => labelForType(story.stateType));
  return stories.length === 0 ? [] : [{ key: "all", label: UNGROUPED_LABEL, stories }];
}
