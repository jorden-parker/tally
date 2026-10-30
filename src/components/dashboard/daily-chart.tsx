"use client";

import { useState } from "react";
import type { DailyPoint } from "@/lib/metrics/summary";
import { formatDay } from "./format";

const LEFT = 28;
const TOP = 8;
const PLOT_HEIGHT = 120;
const BOTTOM = 24;
const COLUMN_WIDTH = 20;
const BAR_WIDTH = 7;
const BAR_GAP = 2;
const BAR_RADIUS = 3;
const MIN_SCALE = 4;
const LABEL_EVERY = 7;

type DailyChartProps = { points: DailyPoint[] };

type BarProps = { x: number; value: number; scale: number; className: string };

function Bar({ x, value, scale, className }: BarProps) {
  if (value === 0) return null;
  const height = (value / scale) * PLOT_HEIGHT;
  return (
    <rect
      x={x}
      y={TOP + PLOT_HEIGHT - height}
      width={BAR_WIDTH}
      height={height}
      rx={BAR_RADIUS}
      className={className}
    />
  );
}

function describe(point: DailyPoint): string {
  return `${formatDay(point.day)}: ${point.reviewed} reviewed, ${point.created} created`;
}

function Legend() {
  return (
    <ul aria-label="Legend" className="flex gap-5 text-sm">
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-reviewed" aria-hidden="true" />
        Reviewed
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3 rounded-sm bg-created" aria-hidden="true" />
        Created
      </li>
    </ul>
  );
}

function TableView({ points }: DailyChartProps) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-soft">View as table</summary>
      <table className="mt-2 w-full max-w-md text-left">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Reviewed</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <th scope="row" className="font-normal">
                {formatDay(point.day)}
              </th>
              <td>{point.reviewed}</td>
              <td>{point.created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Tooltip({ point, index, width }: { point: DailyPoint; index: number; width: number }) {
  const left = ((LEFT + (index + 0.5) * COLUMN_WIDTH) / width) * 100;
  return (
    <div
      role="tooltip"
      style={{ left: `${left}%` }}
      className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col rounded-md border border-rule bg-paper px-3 py-2 text-sm shadow-sm"
    >
      <strong>{formatDay(point.day)}</strong>
      <span>{point.reviewed} reviewed</span>
      <span>{point.created} created</span>
    </div>
  );
}

export function DailyChart({ points }: DailyChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const scale = Math.max(MIN_SCALE, ...points.flatMap((point) => [point.reviewed, point.created]));
  const width = LEFT + points.length * COLUMN_WIDTH;
  const height = TOP + PLOT_HEIGHT + BOTTOM;
  const baseline = TOP + PLOT_HEIGHT;

  return (
    <div className="flex flex-col gap-3">
      <Legend />
      <div className="relative">
        <svg
          role="group"
          aria-label="Bars of PRs reviewed and created per day over the last four weeks"
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
        >
          <g className="text-ink-soft" fontSize={11} fill="currentColor">
            <text x={LEFT - 6} y={TOP + 4} textAnchor="end">
              {scale}
            </text>
            <text x={LEFT - 6} y={baseline + 4} textAnchor="end">
              0
            </text>
          </g>
          <line x1={LEFT} x2={width} y1={TOP} y2={TOP} className="stroke-rule" />
          <line x1={LEFT} x2={width} y1={baseline} y2={baseline} className="stroke-rule" />
          {points.map((point, index) => {
            const left = LEFT + index * COLUMN_WIDTH;
            const barsStart = left + (COLUMN_WIDTH - (2 * BAR_WIDTH + BAR_GAP)) / 2;
            return (
              <g key={point.day}>
                <Bar x={barsStart} value={point.reviewed} scale={scale} className="fill-reviewed" />
                <Bar
                  x={barsStart + BAR_WIDTH + BAR_GAP}
                  value={point.created}
                  scale={scale}
                  className="fill-created"
                />
                {index % LABEL_EVERY === 0 ? (
                  <text
                    x={left}
                    y={baseline + 16}
                    fontSize={11}
                    fill="currentColor"
                    className="text-ink-soft"
                  >
                    {formatDay(point.day)}
                  </text>
                ) : null}
                <rect
                  role="img"
                  aria-label={describe(point)}
                  data-testid={`day-${point.day}`}
                  tabIndex={0}
                  x={left}
                  y={TOP}
                  width={COLUMN_WIDTH}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active === null ? null : <Tooltip point={points[active]} index={active} width={width} />}
      </div>
      <TableView points={points} />
    </div>
  );
}
