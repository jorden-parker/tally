import type { Range } from "@/lib/metrics/summary";

const COMPARISON_LABELS: Record<Range, string> = {
  day: "yesterday",
  week: "this point last week",
  "30d": "the 30 days before",
};

const MAX_TALLY_MARKS = 50;
const MARKS_PER_GROUP = 5;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function comparisonLabel(range: Range): string {
  return COMPARISON_LABELS[range];
}

export function deltaText(current: number, previous: number, range: Range): string {
  const label = comparisonLabel(range);
  if (current === previous) return `same as ${label}`;
  const difference = Math.abs(current - previous);
  return `${difference} ${current > previous ? "more" : "fewer"} than ${label}`;
}

export function isStale(lastSyncedAt: string | null, now: Date, maxAgeMs: number): boolean {
  return lastSyncedAt === null || now.getTime() - new Date(lastSyncedAt).getTime() > maxAgeMs;
}

export function formatDay(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

export function formatSynced(lastSyncedAt: string | null, now: Date): string {
  if (lastSyncedAt === null) return "Not synced yet";
  const age = now.getTime() - new Date(lastSyncedAt).getTime();
  if (age < MINUTE_MS) return "Synced just now";
  if (age < HOUR_MS) return `Synced ${plural(Math.floor(age / MINUTE_MS), "minute")} ago`;
  if (age < DAY_MS) return `Synced ${plural(Math.floor(age / HOUR_MS), "hour")} ago`;
  return `Synced ${plural(Math.floor(age / DAY_MS), "day")} ago`;
}

export function tallyGroups(count: number): {
  groups: number;
  remainder: number;
  overflow: number;
} {
  const drawn = Math.min(count, MAX_TALLY_MARKS);
  return {
    groups: Math.floor(drawn / MARKS_PER_GROUP),
    remainder: drawn % MARKS_PER_GROUP,
    overflow: count - drawn,
  };
}
