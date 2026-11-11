"use client";

import Link from "next/link";
import { RefreshCwIcon } from "lucide-react";
import { EmptyNote, LoadingNote, PageShell, ProblemAlert } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

function isRange(value: unknown): value is Range {
  return RANGES.includes(value as Range);
}

function RangeSwitch({ range, onChange }: { range: Range; onChange: (range: Range) => void }) {
  return (
    <ToggleGroup
      aria-label="Time range"
      value={[range]}
      onValueChange={(selected) => {
        const [chosen] = selected;
        if (isRange(chosen)) onChange(chosen);
      }}
      spacing={0}
      className="rounded-lg border bg-background p-0.5"
    >
      {RANGES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          size="sm"
          className="rounded-md! px-3 text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
        >
          {RANGE_LABELS[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function SetupNotes({ settings }: { settings: Settings }) {
  if (settings.allowList.length > 0) return null;
  return (
    <EmptyNote>
      No GitHub orgs or repos are counted yet.{" "}
      <Link href="/settings" className="font-medium text-foreground underline underline-offset-4">
        Choose them in settings
      </Link>
      .
    </EmptyNote>
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
      <section aria-label="Daily activity">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold tracking-tight">
                The last four weeks, in scribbles
              </h2>
            </CardTitle>
            <CardDescription>PRs you reviewed and created each day.</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyChart points={summary.daily} />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export function Dashboard({ api = realApi, now = currentTime }: DashboardProps) {
  const { range, setRange, summary, settings, syncing, problems, sync } = useDashboard(api, now);

  return (
    <PageShell
      title="Dashboard"
      description={formatSynced(summary?.lastSyncedAt ?? null, now())}
      actions={
        <>
          <RangeSwitch range={range} onChange={setRange} />
          <Button onClick={sync} disabled={syncing} size="lg" className="px-3">
            <RefreshCwIcon data-icon="inline-start" className={syncing ? "animate-spin" : ""} />
            {syncing ? "Counting sheep…" : "Sync now"}
          </Button>
        </>
      }
    >
      {settings ? <SetupNotes settings={settings} /> : null}
      <ProblemAlert messages={problems} />
      {summary ? <Report summary={summary} /> : <LoadingNote />}
    </PageShell>
  );
}
