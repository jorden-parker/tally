import { z } from "zod";
import { shiftDay } from "@/lib/metrics/buckets";
import { summarize, type DayRange, type Range, type Summary } from "@/lib/metrics/summary";
import { workReport, type WorkReport } from "@/lib/metrics/work";
import { eventsBetween } from "@/lib/store/events";
import { loadOpenItems } from "@/lib/store/open-items";
import { loadSettings, loadSnapshots, saveSettings, type Settings } from "@/lib/store/settings";
import { completedWork } from "@/lib/store/work";
import { SYNC_WINDOW_DAYS, syncAll, type SyncDependencies, type SyncResult } from "@/lib/sync";

export type Services = {
  summary: (range: Range) => Summary;
  work: (period: DayRange) => WorkReport;
  sync: () => Promise<SyncResult>;
  settings: () => Settings;
  updateSettings: (input: unknown) => Settings;
};

export class InvalidSettingsError extends Error {}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const OWNER_OR_REPO = /^[\w.-]+(\/[\w.-]+)?$/;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const settingsChanges = z
  .strictObject({
    allowList: z
      .array(z.string().trim())
      .transform((entries) => entries.filter((entry) => entry !== ""))
      .pipe(z.array(z.string().regex(OWNER_OR_REPO))),
    weekStart: z.union([z.literal(0), z.literal(1)]),
    timeZone: z.string().refine(isTimeZone),
  })
  .partial();

const dayRange = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => from <= to);

export function parseDayRange(from: string | null, to: string | null): DayRange | null {
  const parsed = dayRange.safeParse({ from, to });
  return parsed.success ? parsed.data : null;
}

function startOfDay(day: string): string {
  return `${day}T00:00:00Z`;
}

export function createServices(dependencies: SyncDependencies): Services {
  const { db, now } = dependencies;

  const settings = (): Settings => loadSettings(db);

  return {
    summary: (range) => {
      const current = now();
      const from = new Date(current.getTime() - (SYNC_WINDOW_DAYS + 2) * MILLISECONDS_PER_DAY);
      const to = new Date(current.getTime() + MILLISECONDS_PER_DAY);
      return summarize({
        events: eventsBetween(db, from.toISOString(), to.toISOString()),
        openItems: loadOpenItems(db),
        snapshots: loadSnapshots(db),
        settings: loadSettings(db),
        range,
        now: current,
      });
    },
    work: (period) =>
      workReport({
        items: completedWork(
          db,
          startOfDay(shiftDay(period.from, -1)),
          startOfDay(shiftDay(period.to, 2)),
        ),
        openItems: loadOpenItems(db),
        settings: loadSettings(db),
        period,
      }),
    sync: () => syncAll(dependencies),
    settings,
    updateSettings: (input) => {
      const parsed = settingsChanges.safeParse(input);
      if (!parsed.success) throw new InvalidSettingsError(z.prettifyError(parsed.error));
      saveSettings(db, parsed.data);
      return settings();
    },
  };
}
