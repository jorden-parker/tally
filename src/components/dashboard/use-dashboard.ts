import { useCallback, useEffect, useRef, useState } from "react";
import type { Range, Summary } from "@/lib/metrics/summary";
import type { Settings } from "@/lib/store/settings";
import type { SyncResult } from "@/lib/sync";
import type { TallyApi } from "../api";
import { isStale } from "./format";

const AUTO_SYNC_MAX_AGE_MS = 10 * 60 * 1000;

const SOURCE_LABELS = { github: "GitHub", shortcut: "Shortcut" };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeSyncErrors(errors: SyncResult["errors"]): string[] {
  return Object.entries(errors).map(
    ([source, message]) => `${SOURCE_LABELS[source as keyof typeof SOURCE_LABELS]}: ${message}`,
  );
}

function describeUncountedReviews(repos: string[]): string[] {
  return repos.length === 0
    ? []
    : [`Reviews in ${repos.join(", ")} aren't counted. Add them in Settings to count them.`];
}

export function useDashboard(api: TallyApi, now: () => Date) {
  const [range, setRange] = useState<Range>("week");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [reloads, setReloads] = useState(0);
  const autoSyncAttempted = useRef(false);

  useEffect(() => {
    let current = true;
    api
      .fetchSummary(range)
      .then((loaded) => current && setSummary(loaded))
      .catch((error) => current && setProblems([messageOf(error)]));
    return () => {
      current = false;
    };
  }, [api, range, reloads]);

  useEffect(() => {
    api
      .fetchSettings()
      .then(setSettings)
      .catch((error) => setProblems([messageOf(error)]));
  }, [api]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await api.runSync();
      setProblems([
        ...describeSyncErrors(result.errors),
        ...describeUncountedReviews(result.uncountedReviewRepos),
      ]);
      setReloads((count) => count + 1);
    } catch (error) {
      setProblems([messageOf(error)]);
    } finally {
      setSyncing(false);
    }
  }, [api]);

  useEffect(() => {
    if (autoSyncAttempted.current || !summary || !settings) return;
    const due = isStale(summary.lastSyncedAt, now(), AUTO_SYNC_MAX_AGE_MS);
    if (!due) {
      autoSyncAttempted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      autoSyncAttempted.current = true;
      void sync();
    }, 0);
    return () => clearTimeout(timer);
  }, [summary, settings, now, sync]);

  return { range, setRange, summary, settings, syncing, problems, sync };
}
