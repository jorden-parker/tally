import type { OpenItem } from "@/lib/store/open-items";
import type { Settings } from "@/lib/store/settings";
import type { WorkItem } from "@/lib/store/work";
import { countByBucket, dayKey, type BucketCount } from "./buckets";
import { allowedEvents, openWork, type DayRange } from "./summary";

export type WorkRow = WorkItem & { day: string };

export type DraftRow = OpenItem & { day: string };

export type WorkTotals = {
  prsMerged: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  prsWithoutSize: number;
  ticketsCompleted: number;
  points: number;
  unestimatedTickets: number;
  ticketsByType: BucketCount[];
  medianPrCycleMs: number | null;
  medianTicketCycleMs: number | null;
};

export type WorkReport = DayRange & {
  totals: WorkTotals;
  prs: WorkRow[];
  tickets: WorkRow[];
  drafts: DraftRow[];
};

export type WorkReportInput = {
  items: WorkItem[];
  openItems: OpenItem[];
  settings: Settings;
  period: DayRange;
};

export function cycleTimeMs(item: WorkItem): number | null {
  if (item.startedAt === null) return null;
  return new Date(item.occurredAt).getTime() - new Date(item.startedAt).getTime();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianCycleTime(items: WorkItem[]): number | null {
  return median(items.map(cycleTimeMs).filter((time) => time !== null));
}

function sum(values: (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function totalsOf(prs: WorkRow[], tickets: WorkRow[]): WorkTotals {
  const typedTickets = tickets.flatMap(({ storyType }) => (storyType === null ? [] : [storyType]));
  return {
    prsMerged: prs.length,
    additions: sum(prs.map((pr) => pr.additions)),
    deletions: sum(prs.map((pr) => pr.deletions)),
    changedFiles: sum(prs.map((pr) => pr.changedFiles)),
    prsWithoutSize: prs.filter((pr) => pr.additions === null).length,
    ticketsCompleted: tickets.length,
    points: sum(tickets.map((ticket) => ticket.points)),
    unestimatedTickets: tickets.filter((ticket) => ticket.points === null).length,
    ticketsByType: countByBucket(typedTickets, (storyType) => storyType),
    medianPrCycleMs: medianCycleTime(prs),
    medianTicketCycleMs: medianCycleTime(tickets),
  };
}

export function workReport({ items, openItems, settings, period }: WorkReportInput): WorkReport {
  const { timeZone, allowList } = settings;
  const rows = allowedEvents(items, allowList)
    .map((item) => ({ ...item, day: dayKey(item.occurredAt, timeZone) }))
    .filter(({ day }) => day >= period.from && day <= period.to)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const prs = rows.filter((row) => row.kind === "pr_merged");
  const tickets = rows.filter((row) => row.kind === "story_completed");
  const drafts = openWork(openItems, allowList)
    .prs.filter((item) => item.isDraft)
    .map((item) => ({ ...item, day: dayKey(item.openedAt, timeZone) }));
  return { ...period, totals: totalsOf(prs, tickets), prs, tickets, drafts };
}
