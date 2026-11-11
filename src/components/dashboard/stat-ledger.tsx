import type { PeriodTotals, Summary } from "@/lib/metrics/summary";
import { deltaText } from "./format";
import { TallyMarks } from "./tally-marks";

const PERIOD_FIGURES: { label: string; key: keyof PeriodTotals }[] = [
  { label: "PRs created", key: "created" },
  { label: "PRs merged", key: "merged" },
  { label: "Tickets completed", key: "completed" },
];

type FigureProps = { label: string; value: number; note: string };

function Figure({ label, value, note }: FigureProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-6 py-5">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="row-span-2 font-hand text-5xl leading-none font-bold">{value}</dd>
      <dd className="text-sm text-muted-foreground">{note}</dd>
    </div>
  );
}

function Hero({ summary }: { summary: Summary }) {
  const { reviewed } = summary.current;
  return (
    <section aria-label="Reviewed this period" className="flex flex-col gap-4 p-6 sm:p-8">
      <TallyMarks count={reviewed} label={`${reviewed} PRs reviewed`} />
      <p className="flex items-baseline gap-3">
        <span className="font-hand text-8xl leading-none font-bold">{reviewed}</span>
        <span className="text-lg font-medium tracking-tight">PRs reviewed</span>
      </p>
      <p className="text-muted-foreground">
        {deltaText(reviewed, summary.previous.reviewed, summary.range)}
      </p>
    </section>
  );
}

export function StatLedger({ summary }: { summary: Summary }) {
  return (
    <div className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[3fr_2fr]">
      <Hero summary={summary} />
      <dl className="flex flex-col divide-y border-t lg:border-t-0 lg:border-l">
        {PERIOD_FIGURES.map(({ label, key }) => (
          <Figure
            key={key}
            label={label}
            value={summary.current[key]}
            note={deltaText(summary.current[key], summary.previous[key], summary.range)}
          />
        ))}
      </dl>
    </div>
  );
}
