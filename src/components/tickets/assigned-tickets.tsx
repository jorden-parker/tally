"use client";

import { useState } from "react";
import {
  EmptyNote,
  LoadingNote,
  PageShell,
  ProblemAlert,
  SectionHeading,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
import { InlineMarkdown } from "@/components/inline-markdown";

const SEPARATOR = " · ";
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const FIELD_LABEL_CLASS = "flex items-center gap-2 text-sm text-muted-foreground";

const GROUPING_LABELS: Record<StatusGrouping, string> = {
  state: "Workflow state",
  type: "State type",
  none: "Nothing",
};

function describeStory(story: AssignedStory): string {
  return [
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
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-4 hover:underline"
        >
          <InlineMarkdown text={story.title} />
        </a>
        <span className="text-sm text-muted-foreground">
          <span className="font-mono text-xs">sc-{story.id}</span>
          {describeStory(story) === "" ? null : `${SEPARATOR}${describeStory(story)}`}
        </span>
      </div>
      <Badge variant="outline" className="shrink-0">
        {story.state}
      </Badge>
    </li>
  );
}

function GroupSection({ group }: { group: StoryGroup }) {
  return (
    <section aria-label={group.label} className="flex flex-col gap-4">
      <SectionHeading title={group.label} count={group.stories.length} />
      <ul className="divide-y rounded-xl border bg-card">
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
    <label className={FIELD_LABEL_CLASS}>
      Status
      <NativeSelect value={value} onChange={(event) => onChange(event.target.value)}>
        <NativeSelectOption value={ALL_STATUSES}>All statuses</NativeSelectOption>
        {listStatusOptions(stories).map((option) => (
          <NativeSelectOptGroup key={option.label} label={option.label}>
            {option.type === null ? null : (
              <NativeSelectOption value={filterForType(option.type)}>
                Any {option.label.toLowerCase()}
              </NativeSelectOption>
            )}
            {option.states.map((state) => (
              <NativeSelectOption key={state} value={filterForState(state)}>
                {state}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
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
    <label className={FIELD_LABEL_CLASS}>
      Group by
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value as StatusGrouping)}
      >
        {Object.entries(GROUPING_LABELS).map(([grouping, label]) => (
          <NativeSelectOption key={grouping} value={grouping}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

function TicketList({ stories }: { stories: AssignedStory[] }) {
  const [status, setStatus] = useState(ALL_STATUSES);
  const [grouping, setGrouping] = useState<StatusGrouping>("state");
  const groups = groupByStatus(filterByStatus(stories, status), grouping);
  return (
    <>
      <div className="-mt-4 flex flex-wrap gap-4 border-b pb-6">
        <StatusSelect stories={stories} value={status} onChange={setStatus} />
        <GroupingSelect value={grouping} onChange={setGrouping} />
      </div>
      {groups.length === 0 ? (
        <EmptyNote>No tickets here. Try another status, or sync.</EmptyNote>
      ) : (
        groups.map((group) => <GroupSection key={group.key} group={group} />)
      )}
    </>
  );
}

export function AssignedTickets({ api = realApi }: { api?: TallyApi }) {
  const { stories, problem } = useAssignedTickets(api);
  return (
    <PageShell title="Tickets" description="Every Shortcut story you own, by status.">
      <ProblemAlert messages={problem === null ? [] : [problem]} />
      {stories === null ? (
        problem === null ? (
          <LoadingNote />
        ) : null
      ) : (
        <TicketList stories={stories} />
      )}
    </PageShell>
  );
}
