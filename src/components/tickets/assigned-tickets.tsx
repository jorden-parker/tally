"use client";

import Link from "next/link";
import { useState } from "react";
import { dayKey } from "@/lib/metrics/buckets";
import {
  ALL_STATUSES,
  filterByStatus,
  groupByStatus,
  filterForState,
  listStatusOptions,
  filterForType,
  type StatusGrouping,
  type StoryGroup,
} from "@/lib/metrics/status-groups";
import type { AssignedStory } from "@/lib/store/assigned-stories";
import { api as realApi, type TallyApi } from "../api";
import { formatLongDay } from "../dashboard/format";
import { useAssignedTickets } from "./use-assigned-tickets";

const SEPARATOR = " · ";
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const FIELD_CLASS = "sketch-border bg-paper px-2 py-1 text-ink";

const GROUPING_LABELS: Record<StatusGrouping, string> = {
  state: "Workflow state",
  type: "State type",
  none: "Nothing",
};

function describeStory(story: AssignedStory): string {
  return [
    `sc-${story.id}`,
    story.storyType,
    story.estimate === null ? null : `${story.estimate} pt`,
    story.completedAt === null
      ? null
      : `Completed ${formatLongDay(dayKey(story.completedAt, LOCAL_TIME_ZONE))}`,
  ]
    .filter((part) => part !== null)
    .join(SEPARATOR);
}

function StoryRow({ story }: { story: AssignedStory }) {
  return (
    <li className="flex flex-col">
      <a
        href={story.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {story.title}
      </a>
      <span className="text-sm text-ink-soft">
        {describeStory(story)}
        {SEPARATOR}
        <span className="sketch-border px-1.5">{story.state}</span>
      </span>
    </li>
  );
}

function GroupSection({ group }: { group: StoryGroup }) {
  return (
    <section aria-label={group.label} className="flex flex-col gap-3">
      <h2 className="font-hand text-3xl font-bold">
        {group.label} ({group.stories.length})
      </h2>
      <ul className="flex flex-col gap-3">
        {group.stories.map((story) => (
          <StoryRow key={story.id} story={story} />
        ))}
      </ul>
    </section>
  );
}

function StatusSelect({
  stories,
  value,
  onChange,
}: {
  stories: AssignedStory[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Status
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      >
        <option value={ALL_STATUSES}>All statuses</option>
        {listStatusOptions(stories).map((option) => (
          <optgroup key={option.label} label={option.label}>
            {option.type === null ? null : (
              <option value={filterForType(option.type)}>Any {option.label.toLowerCase()}</option>
            )}
            {option.states.map((state) => (
              <option key={state} value={filterForState(state)}>
                {state}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function GroupingSelect({
  value,
  onChange,
}: {
  value: StatusGrouping;
  onChange: (value: StatusGrouping) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      Group by
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StatusGrouping)}
        className={FIELD_CLASS}
      >
        {Object.entries(GROUPING_LABELS).map(([grouping, label]) => (
          <option key={grouping} value={grouping}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TicketList({ stories }: { stories: AssignedStory[] }) {
  const [status, setStatus] = useState(ALL_STATUSES);
  const [grouping, setGrouping] = useState<StatusGrouping>("state");
  const groups = groupByStatus(filterByStatus(stories, status), grouping);
  return (
    <>
      <div className="flex flex-wrap gap-4">
        <StatusSelect stories={stories} value={status} onChange={setStatus} />
        <GroupingSelect value={grouping} onChange={setGrouping} />
      </div>
      {groups.length === 0 ? (
        <p className="text-ink-soft">No tickets here. Try another status, or sync.</p>
      ) : (
        groups.map((group) => <GroupSection key={group.key} group={group} />)
      )}
    </>
  );
}

export function AssignedTickets({ api = realApi }: { api?: TallyApi }) {
  const { stories, problem } = useAssignedTickets(api);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-10 pb-28">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="highlighter px-1 font-hand text-5xl font-bold">All my tickets</h1>
        <Link href="/" className="wobble text-sm underline underline-offset-4">
          Dashboard
        </Link>
      </header>
      {problem === null ? null : (
        <p role="alert" className="max-w-2xl -rotate-1 rounded-sm bg-sticky-bug p-4 doodle-shadow">
          {problem}
        </p>
      )}
      {stories === null ? (
        problem === null ? (
          <p className="font-hand text-2xl text-ink-soft">Sharpening pencils…</p>
        ) : null
      ) : (
        <TicketList stories={stories} />
      )}
    </main>
  );
}
