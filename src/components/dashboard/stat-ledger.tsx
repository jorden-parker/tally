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
    <div className="flex flex-col gap-1 border-l border-rule pl-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-3xl font-semibold">{value}</dd>
      <dd className="text-sm text-ink-soft">{note}</dd>
    </div>
  );
}

function Hero({ summary }: { summary: Summary }) {
  const { reviewed } = summary.current;
  return (
    <section aria-label="Reviewed this period" className="flex flex-col gap-3">
      <TallyMarks count={reviewed} label={`${reviewed} PRs reviewed`} />
      <p className="flex items-baseline gap-3">
        <span className="text-6xl font-semibold">{reviewed}</span>
        <span className="text-lg">PRs reviewed</span>
      </p>
      <p className="text-ink-soft">
        {deltaText(reviewed, summary.previous.reviewed, summary.range)}
      </p>
    </section>
  );
}

export function StatLedger({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-8">
      <Hero summary={summary} />
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
