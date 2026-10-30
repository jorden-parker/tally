"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { DraftRow, WorkReport, WorkRow, WorkTotals } from "@/lib/metrics/work";
import { formatCycleTime, prDetail, ticketDetail, workMarkdown } from "@/lib/metrics/work-markdown";
import { plural } from "@/lib/text";
import { api as realApi, type TallyApi } from "../api";
import { useWorkLog } from "./use-work-log";

const currentTime = () => new Date();

const BUTTON_CLASS = "rounded-md border border-rule px-3 py-1.5 text-sm text-ink";

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

function coverageNotes({ prsWithoutSize, unestimatedTickets }: WorkTotals): string[] {
  const notes = [];
  if (prsWithoutSize > 0) {
    notes.push(
      `${plural(prsWithoutSize, "PR")} ${prsWithoutSize === 1 ? "has" : "have"} no size data.`,
    );
  }
  if (unestimatedTickets > 0) {
    notes.push(
      `${plural(unestimatedTickets, "ticket")} ${unestimatedTickets === 1 ? "has" : "have"} no estimate.`,
    );
  }
  return notes;
}

function Totals({ totals }: { totals: WorkTotals }) {
  const types = totals.ticketsByType.map(({ key, count }) => `${count} ${key}`).join(", ");
  return (
    <section aria-label="Totals" className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <Stat label="PRs merged" value={String(totals.prsMerged)} />
        <Stat label="Lines changed" value={`+${totals.additions} −${totals.deletions}`} />
        <Stat label="Median PR cycle time" value={formatCycleTime(totals.medianPrCycleMs)} />
        <Stat label="Tickets completed" value={String(totals.ticketsCompleted)} />
        <Stat label="Points" value={String(totals.points)} />
        <Stat
          label="Median ticket cycle time"
          value={formatCycleTime(totals.medianTicketCycleMs)}
        />
      </dl>
      {types === "" ? null : <p className="text-sm text-ink-soft">{types}</p>}
      {coverageNotes(totals).map((note) => (
        <p key={note} className="text-sm text-ink-soft">
          {note}
        </p>
      ))}
    </section>
  );
}

function Row({ row, children }: { row: WorkRow | DraftRow; children: ReactNode }) {
  return (
    <li className="flex flex-col">
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {row.title}
      </a>
      <span className="text-sm text-ink-soft">{children}</span>
    </li>
  );
}

function RowSection({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: ReactNode[];
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="text-ink-soft">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">{children}</ul>
      )}
    </section>
  );
}

function evidenceLine(row: WorkRow, detail: string): string {
  return [row.day, row.repo, detail].filter((part) => part !== null).join(" · ");
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
      <ExportActions report={report} />
      <Totals totals={report.totals} />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <RowSection title="PRs merged" emptyText="Nothing in this period">
          {report.prs.map((row) => (
            <Row key={row.externalId} row={row}>
              {evidenceLine(row, prDetail(row))}
            </Row>
          ))}
        </RowSection>
        <RowSection title="Tickets completed" emptyText="Nothing in this period">
          {report.tickets.map((row) => (
            <Row key={row.externalId} row={row}>
              {evidenceLine(row, ticketDetail(row))}
            </Row>
          ))}
        </RowSection>
      </div>
      <RowSection title="Draft PRs (current)" emptyText="No draft PRs">
        {report.drafts.map((row) => (
          <Row key={row.externalId} row={row}>
            Opened {row.day} · {row.repo}
          </Row>
        ))}
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
