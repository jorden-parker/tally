import { filterToAllowList } from "@/lib/github/allow-list";
import type { EventKind, TallyEvent } from "@/lib/store/events";
import type { OpenItem } from "@/lib/store/open-items";
import type { Settings, Snapshots } from "@/lib/store/settings";
import { dayKey, shiftDay, weekKey } from "./buckets";

export const RANGES = ["day", "week", "30d"] as const;

export type Range = (typeof RANGES)[number];

export function isRange(value: string): value is Range {
  return (RANGES as readonly string[]).includes(value);
}

export type PeriodTotals = {
  reviewed: number;
  created: number;
  merged: number;
  completed: number;
};

export type DailyPoint = { day: string; reviewed: number; created: number };

export type Summary = {
  range: Range;
  current: PeriodTotals;
  previous: PeriodTotals;
  now: Snapshots;
  daily: DailyPoint[];
  lists: {
    reviewed: TallyEvent[];
    created: TallyEvent[];
    merged: TallyEvent[];
    completed: TallyEvent[];
  };
  open: { prs: OpenItem[]; tickets: OpenItem[] };
  lastSyncedAt: string | null;
};

export type SummaryInput = {
  events: TallyEvent[];
  openItems: OpenItem[];
  snapshots: Snapshots;
  settings: Settings;
  range: Range;
  now: Date;
};

type DayRange = { from: string; to: string };

type DatedEvent = { event: TallyEvent; day: string };

const DAILY_POINTS = 28;

function allowedEvents(events: TallyEvent[], allowList: string[]): TallyEvent[] {
  const github = events.filter((event) => event.source === "github");
  const others = events.filter((event) => event.source !== "github");
  return [...filterToAllowList(github, allowList), ...others];
}

function openWork(items: OpenItem[], allowList: string[]): Summary["open"] {
  return {
    prs: filterToAllowList(
      items.filter((item) => item.source === "github"),
      allowList,
    ),
    tickets: items.filter((item) => item.source === "shortcut"),
  };
}

function currentPeriod(input: SummaryInput, today: string): { current: DayRange; shift: number } {
  const { range, settings, now } = input;
  if (range === "day") return { current: { from: today, to: today }, shift: 1 };
  if (range === "week") {
    const from = weekKey(now.toISOString(), settings.timeZone, settings.weekStart);
    return { current: { from, to: today }, shift: 7 };
  }
  return { current: { from: shiftDay(today, -29), to: today }, shift: 30 };
}

function shiftRange(period: DayRange, days: number): DayRange {
  return { from: shiftDay(period.from, -days), to: shiftDay(period.to, -days) };
}

function inPeriod(dated: DatedEvent[], kind: EventKind, period: DayRange): TallyEvent[] {
  return dated
    .filter(({ event, day }) => event.kind === kind && day >= period.from && day <= period.to)
    .map(({ event }) => event)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function distinctByUrl(newestFirst: TallyEvent[]): TallyEvent[] {
  const seen = new Set<string>();
  return newestFirst.filter((event) => {
    if (seen.has(event.url)) return false;
    seen.add(event.url);
    return true;
  });
}

function lists(dated: DatedEvent[], period: DayRange): Summary["lists"] {
  return {
    reviewed: distinctByUrl(inPeriod(dated, "pr_reviewed", period)),
    created: inPeriod(dated, "pr_created", period),
    merged: inPeriod(dated, "pr_merged", period),
    completed: inPeriod(dated, "story_completed", period),
  };
}

function totals(dated: DatedEvent[], period: DayRange): PeriodTotals {
  const items = lists(dated, period);
  return {
    reviewed: items.reviewed.length,
    created: items.created.length,
    merged: items.merged.length,
    completed: items.completed.length,
  };
}

function dailyPoints(dated: DatedEvent[], today: string): DailyPoint[] {
  return Array.from({ length: DAILY_POINTS }, (_, index) => {
    const day = shiftDay(today, index + 1 - DAILY_POINTS);
    const { reviewed, created } = totals(dated, { from: day, to: day });
    return { day, reviewed, created };
  });
}

export function summarize(input: SummaryInput): Summary {
  const { settings, snapshots, range, now } = input;
  const today = dayKey(now.toISOString(), settings.timeZone);
  const dated = allowedEvents(input.events, settings.allowList).map((event) => ({
    event,
    day: dayKey(event.occurredAt, settings.timeZone),
  }));
  const { current, shift } = currentPeriod(input, today);
  return {
    range,
    current: totals(dated, current),
    previous: totals(dated, shiftRange(current, shift)),
    now: snapshots,
    daily: dailyPoints(dated, today),
    lists: lists(dated, current),
    open: openWork(input.openItems, settings.allowList),
    lastSyncedAt: settings.lastSyncedAt,
  };
}
