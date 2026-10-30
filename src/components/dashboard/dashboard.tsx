"use client";

import Link from "next/link";
import { RANGES, type Range, type Summary } from "@/lib/metrics/summary";
import type { Settings } from "@/lib/store/settings";
import { api as realApi, type TallyApi } from "../api";
import { DailyChart } from "./daily-chart";
import { formatSynced } from "./format";
import { ItemLists, OpenLists } from "./item-lists";
import { StatLedger } from "./stat-ledger";
import { useDashboard } from "./use-dashboard";

const RANGE_LABELS: Record<Range, string> = {
  day: "Today",
  week: "This week",
  "30d": "Last 30 days",
};

const currentTime = () => new Date();

type DashboardProps = { api?: TallyApi; now?: () => Date };

function RangeSwitch({ range, onChange }: { range: Range; onChange: (range: Range) => void }) {
  return (
    <div role="group" aria-label="Time range" className="flex gap-1">
      {RANGES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === range}
          onClick={() => onChange(option)}
          className="rounded-md px-3 py-1.5 text-sm aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {RANGE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

function SetupNotes({ settings }: { settings: Settings }) {
  return (
    <div className="flex flex-col gap-1 text-ink-soft">
      {settings.allowList.length === 0 ? (
        <p>
          No GitHub orgs or repos are counted yet.{" "}
          <Link href="/settings" className="text-ink underline underline-offset-4">
            Choose them in settings
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function Problems({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-md border border-rule p-4">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

function Report({ summary }: { summary: Summary }) {
  return (
    <>
      <StatLedger summary={summary} />
      <OpenLists open={summary.open} />
      <section aria-label="Daily activity" className="flex flex-col gap-3">
        <h2 className="font-semibold">Last four weeks</h2>
        <DailyChart points={summary.daily} />
      </section>
      <ItemLists lists={summary.lists} />
    </>
  );
}

export function Dashboard({ api = realApi, now = currentTime }: DashboardProps) {
  const { range, setRange, summary, settings, syncing, problems, sync } = useDashboard(api, now);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tally</h1>
        <RangeSwitch range={range} onChange={setRange} />
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span>{formatSynced(summary?.lastSyncedAt ?? null, now())}</span>
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="rounded-md border border-rule px-3 py-1.5 text-ink disabled:opacity-60"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <Link href="/work" className="underline underline-offset-4">
            Work log
          </Link>
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>
        </div>
      </header>
      {settings ? <SetupNotes settings={settings} /> : null}
      <Problems messages={problems} />
      {summary ? <Report summary={summary} /> : <p className="text-ink-soft">Loading…</p>}
    </main>
  );
}
