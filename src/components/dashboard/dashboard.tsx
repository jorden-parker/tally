"use client";

import Link from "next/link";
import { RANGES, type Range, type Summary } from "@/lib/metrics/summary";
import type { Settings } from "@/lib/store/settings";
import { api as realApi, type TallyApi } from "../api";
import { DailyChart } from "./daily-chart";
import { formatSynced, RANGE_LABELS } from "./format";
import { StatLedger } from "./stat-ledger";
import { TicketCards } from "./ticket-cards";
import { useDashboard } from "./use-dashboard";

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
          className="wobble rounded-md px-3 py-1.5 text-sm aria-pressed:highlighter aria-pressed:font-semibold"
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
    <div
      role="alert"
      className="flex max-w-2xl -rotate-1 flex-col gap-1 rounded-sm bg-sticky-bug p-4 doodle-shadow"
    >
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
      <TicketCards
        open={summary.open}
        completedTickets={summary.completedTickets}
        range={summary.range}
      />
      <section aria-label="Daily activity" className="flex flex-col gap-3">
        <h2 className="font-hand text-3xl font-bold">The last four weeks, in scribbles</h2>
        <DailyChart points={summary.daily} />
      </section>
    </>
  );
}

export function Dashboard({ api = realApi, now = currentTime }: DashboardProps) {
  const { range, setRange, summary, settings, syncing, problems, sync } = useDashboard(api, now);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-10 pb-28">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="highlighter px-1 font-hand text-5xl font-bold">Tally</h1>
        <RangeSwitch range={range} onChange={setRange} />
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span>{formatSynced(summary?.lastSyncedAt ?? null, now())}</span>
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="sketch-border doodle-shadow bg-paper px-3 py-1 text-ink transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-60"
          >
            {syncing ? "Counting sheep…" : "Sync now"}
          </button>
          <Link href="/work" className="wobble underline underline-offset-4">
            Work log
          </Link>
          <Link href="/settings" className="wobble underline underline-offset-4">
            Settings
          </Link>
        </div>
      </header>
      {settings ? <SetupNotes settings={settings} /> : null}
      <Problems messages={problems} />
      {summary ? (
        <Report summary={summary} />
      ) : (
        <p className="font-hand text-2xl text-ink-soft">Sharpening pencils…</p>
      )}
    </main>
  );
}
