"use client";

import { useState, type ReactNode } from "react";
import {
  EmptyNote,
  LoadingNote,
  PageShell,
  ProblemAlert,
  SectionHeading,
} from "@/components/layout/page-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { InlineMarkdown } from "@/components/inline-markdown";

const currentTime = () => new Date();

const BUTTON_CLASS = buttonVariants({ variant: "outline", size: "lg", className: "px-3" });
const SEPARATOR = " · ";
const ROW_LIST_CLASS = "divide-y rounded-xl border bg-card";

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
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {label}
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-auto bg-background"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-hand text-4xl leading-none font-bold">{value}</dd>
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
    <Card role="group" aria-label={title}>
      <CardHeader>
        <SectionHeading title={title} level={3} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-6">{children}</dl>
        {notes.map((note) => (
          <p key={note} className="text-sm text-muted-foreground">
            {note}
          </p>
        ))}
      </CardContent>
    </Card>
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
    <section aria-label="Totals" className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <InlineMarkdown text={row.title} />
    </a>
  );
}

function WorkRowItem({ row }: { row: WorkRow }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <RowLink row={row} />
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
    <li className="flex flex-col gap-1 px-4 py-3">
      <RowLink row={row} />
      <span className="text-sm text-muted-foreground">{draftLine(row)}</span>
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
      <SectionHeading title={title} count={count} />
      {count === 0 ? <EmptyNote>{emptyText}</EmptyNote> : children}
    </section>
  );
}

function DayGroups({ rows }: { rows: WorkRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(rows).map(({ day, rows: dayRows }) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{formatLongDay(day)}</h3>
          <ul className={ROW_LIST_CLASS}>
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
    <Button variant="outline" size="lg" onClick={copy} className="px-3">
      {label}
    </Button>
  );
}

function Report({ report }: { report: WorkReport }) {
  return (
    <>
      <div className="-mt-4 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <p className="text-muted-foreground">
          {leadSentence(report.totals)}, {formatDayMonth(report.from)} to{" "}
          {formatDayMonth(report.to)}
        </p>
        <ExportActions report={report} />
      </div>
      <Totals totals={report.totals} />
      <RowSection
        title="PRs merged"
        count={report.prs.length}
        emptyText="A quiet stretch. Nothing here."
      >
        <DayGroups rows={report.prs} />
      </RowSection>
      <RowSection
        title="Tickets completed"
        count={report.tickets.length}
        emptyText="A quiet stretch. Nothing here."
      >
        <DayGroups rows={report.tickets} />
      </RowSection>
      <RowSection
        title="Drafts in progress"
        count={report.drafts.length}
        emptyText="No drafts on the go."
      >
        <ul className={ROW_LIST_CLASS}>
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
    <PageShell
      title="Work log"
      description="What you shipped over any stretch of days."
      actions={
        <>
          <DateField
            label="From"
            value={period.from}
            onChange={(from) => setPeriod({ ...period, from })}
          />
          <DateField label="To" value={period.to} onChange={(to) => setPeriod({ ...period, to })} />
        </>
      }
    >
      <ProblemAlert messages={problem === null ? [] : [problem]} />
      {report ? <Report report={report} /> : null}
      {report === null && problem === null ? <LoadingNote /> : null}
    </PageShell>
  );
}
