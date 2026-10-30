import { z } from "zod";
import { summarize, type Range, type Summary } from "@/lib/metrics/summary";
import { eventsBetween } from "@/lib/store/events";
import { loadSettings, loadSnapshots, saveSettings, type Settings } from "@/lib/store/settings";
import { SYNC_WINDOW_DAYS, syncAll, type SyncDependencies, type SyncResult } from "@/lib/sync";

export type Services = {
  summary: (range: Range) => Summary;
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
        snapshots: loadSnapshots(db),
        settings: loadSettings(db),
        range,
        now: current,
      });
    },
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
