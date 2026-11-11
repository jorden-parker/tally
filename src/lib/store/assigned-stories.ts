import type { DatabaseSync } from "node:sqlite";

export const WORKFLOW_STATE_TYPES = ["backlog", "unstarted", "started", "done"] as const;

export type WorkflowStateType = (typeof WORKFLOW_STATE_TYPES)[number];

export type AssignedStory = {
  id: string;
  title: string;
  url: string;
  openedAt: string;
  completedAt: string | null;
  storyType: string | null;
  estimate: number | null;
  state: string;
  stateType: WorkflowStateType | null;
  statePosition: number | null;
};

type AssignedStoryRow = {
  id: string;
  title: string;
  url: string;
  opened_at: string;
  completed_at: string | null;
  story_type: string | null;
  estimate: number | null;
  state: string;
  state_type: WorkflowStateType | null;
  state_position: number | null;
};

const INSERT_STORY = `
  INSERT INTO assigned_stories
    (id, title, url, opened_at, completed_at, story_type, estimate, state, state_type, state_position)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const ALL_STORIES = `
  SELECT id, title, url, opened_at, completed_at, story_type, estimate, state, state_type, state_position
  FROM assigned_stories
  ORDER BY opened_at DESC, id ASC
`;

function toAssignedStory(row: AssignedStoryRow): AssignedStory {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
    storyType: row.story_type,
    estimate: row.estimate,
    state: row.state,
    stateType: row.state_type,
    statePosition: row.state_position,
  };
}

export function replaceAssignedStories(db: DatabaseSync, stories: AssignedStory[]): void {
  db.prepare(`DELETE FROM assigned_stories`).run();
  const statement = db.prepare(INSERT_STORY);
  for (const story of stories) {
    statement.run(
      story.id,
      story.title,
      story.url,
      story.openedAt,
      story.completedAt,
      story.storyType,
      story.estimate,
      story.state,
      story.stateType,
      story.statePosition,
    );
  }
}

export function loadAssignedStories(db: DatabaseSync): AssignedStory[] {
  return (db.prepare(ALL_STORIES).all() as AssignedStoryRow[]).map(toAssignedStory);
}
