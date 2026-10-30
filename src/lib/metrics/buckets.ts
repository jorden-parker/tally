export type WeekStart = 0 | 1;

export type BucketCount = { key: string; count: number };

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function dayKey(isoTimestamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoTimestamp));
}

export function shiftDay(key: string, days: number): string {
  const shifted = new Date(new Date(`${key}T00:00:00Z`).getTime() + days * MILLISECONDS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

export function weekKey(isoTimestamp: string, timeZone: string, weekStart: WeekStart): string {
  const key = dayKey(isoTimestamp, timeZone);
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
  return shiftDay(key, -((weekday - weekStart + 7) % 7));
}

export function countByBucket<T>(items: T[], bucketOf: (item: T) => string): BucketCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = bucketOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
