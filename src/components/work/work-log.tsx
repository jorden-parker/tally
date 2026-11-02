"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  groupByDay,
  type DraftRow,
  type WorkReport,
  type WorkRow,
  type WorkTotals,
} from "@/lib/metrics/work";
import {
  detailParts,
  formatCycleTime,
  leadSentence,
  workMarkdown,
} from "@/lib/metrics/work-markdown";
import { REVIEW_STATUS_LABELS } from "@/lib/review-status";
import { plural } from "@/lib/text";
import { api as realApi, type TallyApi } from "../api";
import { formatDayMonth, formatLongDay } from "../dashboard/format";
import { useWorkLog } from "./use-work-log";

const currentTime = () => new Date();

const BUTTON_CLASS = "rounded-md border border-rule px-3 py-1.5 text-sm text-ink";
const SEPARATOR = " · ";

type WorkLogProps = { api?: TallyApi; now?: () => Date };

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-rule bg-transparent px-2 py-1 text-ink"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}

function haveOrHas(count: number): string {
  return count === 1 ? "has" : "have";
}

function TotalsBlock({
  title,
  notes,
  children,
}: {
  title: string;
  notes: string[];
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      <dl className="grid grid-cols-3 gap-6">{children}</dl>
      {notes.map((note) => (
        <p key={note} className="text-sm text-ink-soft">
          {note}
        </p>
      ))}
    </div>
  );
}

function PullRequestTotals({ totals }: { totals: WorkTotals }) {
  const notes =
    totals.prsWithoutSize === 0
      ? []
      : [`${plural(totals.prsWithoutSize, "PR")} ${haveOrHas(totals.prsWithoutSize)} no size data`];
  return (
    <TotalsBlock title="Pull requests" notes={notes}>
      <Stat label="Merged" value={String(totals.prsMerged)} />
      <Stat label="Lines changed" value={`+${totals.additions} −${totals.deletions}`} />
      <Stat label="Median cycle time" value={formatCycleTime(totals.medianPrCycleMs)} />
    </TotalsBlock>
  );
}

function TicketTotals({ totals }: { totals: WorkTotals }) {
  const types = totals.ticketsByType.map(({ key, count }) => plural(count, key)).join(", ");
  const notes = [
    ...(types === "" ? [] : [types]),
    ...(totals.unestimatedTickets === 0
      ? []
      : [
          `${plural(totals.unestimatedTickets, "ticket")} ${haveOrHas(totals.unestimatedTickets)} no estimate`,
        ]),
  ];
  return (
    <TotalsBlock title="Tickets" notes={notes}>
      <Stat label="Completed" value={String(totals.ticketsCompleted)} />
      <Stat label="Points" value={String(totals.points)} />
      <Stat label="Median cycle time" value={formatCycleTime(totals.medianTicketCycleMs)} />
    </TotalsBlock>
  );
}

function Totals({ totals }: { totals: WorkTotals }) {
  return (
    <section aria-label="Totals" className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <PullRequestTotals totals={totals} />
      <TicketTotals totals={totals} />
    </section>
  );
}

function RowLink({ row }: { row: WorkRow | DraftRow }) {
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      className="font-medium underline-offset-4 hover:underline"
    >
      {row.title}
    </a>
  );
}

function WorkRowItem({ row }: { row: WorkRow }) {
  return (
    <li className="flex flex-col gap-1">
      <RowLink row={row} />
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
        {detailParts(row).map((part) => (
          <li key={part}>{part}</li>
        ))}
      </ul>
    </li>
  );
}

function draftLine(row: DraftRow): string {
  const status = row.reviewStatus === null ? [] : [REVIEW_STATUS_LABELS[row.reviewStatus]];
  return [`Opened ${formatLongDay(row.day)}`, row.repo, ...status]
    .filter((part) => part !== null)
    .join(SEPARATOR);
}

function DraftRowItem({ row }: { row: DraftRow }) {
  return (
    <li className="flex flex-col">
      <RowLink row={row} />
      <span className="text-sm text-ink-soft">{draftLine(row)}</span>
    </li>
  );
}

function RowSection({
  title,
  count,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="font-semibold">
        {title} ({count})
      </h2>
      {count === 0 ? <p className="text-ink-soft">{emptyText}</p> : children}
    </section>
  );
}

function DayGroups({ rows }: { rows: WorkRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(rows).map(({ day, rows: dayRows }) => (
        <div key={day} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink-soft">{formatLongDay(day)}</h3>
          <ul className="flex flex-col gap-3">
            {dayRows.map((row) => (
              <WorkRowItem key={row.externalId} row={row} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ExportActions({ report }: { report: WorkReport }) {
  const markdown = workMarkdown(report);
  return (
    <div className="flex items-center gap-3">
      <CopyButton key={markdown} text={markdown} />
      <a
        href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
        download={`work-log-${report.from}-to-${report.to}.md`}
        className={BUTTON_CLASS}
      >
        Download .md
      </a>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy Markdown");
  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => setLabel("Copied"),
      () => setLabel("Copy failed"),
    );
  return (
    <button type="button" onClick={copy} className={BUTTON_CLASS}>
      {label}
    </button>
  );
}

function Report({ report }: { report: WorkReport }) {
  return (
    <>
      <p className="text-ink-soft">
        {leadSentence(report.totals)}, {formatDayMonth(report.from)} to {formatDayMonth(report.to)}
      </p>
      <ExportActions report={report} />
      <Totals totals={report.totals} />
      <RowSection title="PRs merged" count={report.prs.length} emptyText="Nothing in this period">
        <DayGroups rows={report.prs} />
      </RowSection>
      <RowSection
        title="Tickets completed"
        count={report.tickets.length}
        emptyText="Nothing in this period"
      >
        <DayGroups rows={report.tickets} />
      </RowSection>
      <RowSection
        title="Drafts in progress"
        count={report.drafts.length}
        emptyText="No drafts in progress"
      >
        <ul className="flex flex-col gap-3">
          {report.drafts.map((row) => (
            <DraftRowItem key={row.externalId} row={row} />
          ))}
        </ul>
      </RowSection>
    </>
  );
}

export function WorkLog({ api = realApi, now = currentTime }: WorkLogProps) {
  const { period, setPeriod, report, problem } = useWorkLog(api, now);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
      <Link href="/" className="text-sm text-ink-soft underline underline-offset-4">
        Back to dashboard
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Work log</h1>
        <div className="flex flex-wrap gap-3">
          <DateField
            label="From"
            value={period.from}
            onChange={(from) => setPeriod({ ...period, from })}
          />
          <DateField label="To" value={period.to} onChange={(to) => setPeriod({ ...period, to })} />
        </div>
      </header>
      {problem === null ? null : (
        <p role="alert" className="rounded-md border border-rule p-4">
          {problem}
        </p>
      )}
      {report ? <Report report={report} /> : null}
      {report === null && problem === null ? <p className="text-ink-soft">Loading…</p> : null}
    </main>
  );
}
