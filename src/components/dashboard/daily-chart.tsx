"use client";

import { useState, type CSSProperties } from "react";
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
const EDGE_ZONE_PERCENT = 25;
const AXIS_FONT_SIZE = 15;
const SCRIBBLE_PATH =
  "M7 2.5C10.5 2 12.6 4.6 12 7.8 11.4 11 8.2 12.4 5.4 11.6 2.6 10.8 1.5 7.6 2.8 5 3.9 2.9 6.2 2.1 8.4 2.9";

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

function ScribbleSwatch({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={`size-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <path d={SCRIBBLE_PATH} fill="currentColor" fillOpacity={0.35} />
    </svg>
  );
}

function Legend() {
  return (
    <ul aria-label="Legend" className="flex gap-5 text-sm">
      <li className="flex items-center gap-2">
        <ScribbleSwatch className="text-reviewed" />
        Reviewed
      </li>
      <li className="flex items-center gap-2">
        <ScribbleSwatch className="text-created" />
        Created
      </li>
    </ul>
  );
}

function TableView({ points }: DailyChartProps) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-md text-muted-foreground hover:text-foreground">
        View as table
      </summary>
      <table className="mt-3 w-full max-w-md text-left [&_td]:py-1 [&_th]:py-1">
        <thead className="border-b text-muted-foreground">
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

type TooltipPlacement = { style: CSSProperties; className: string };

function tooltipPlacement(centrePercent: number): TooltipPlacement {
  if (centrePercent < EDGE_ZONE_PERCENT) return { style: { left: 0 }, className: "" };
  if (centrePercent > 100 - EDGE_ZONE_PERCENT) return { style: { right: 0 }, className: "" };
  return { style: { left: `${centrePercent}%` }, className: "-translate-x-1/2" };
}

function Tooltip({ point, index, width }: { point: DailyPoint; index: number; width: number }) {
  const centre = ((LEFT + (index + 0.5) * COLUMN_WIDTH) / width) * 100;
  const { style, className } = tooltipPlacement(centre);
  return (
    <div
      role="tooltip"
      style={style}
      className={`pointer-events-none absolute top-0 flex flex-col rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ${className}`}
    >
      <strong className="font-hand text-xl leading-none">{formatDay(point.day)}</strong>
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
          <g
            className="font-hand text-muted-foreground"
            fontSize={AXIS_FONT_SIZE}
            fill="currentColor"
          >
            <text x={LEFT - 6} y={TOP + 4} textAnchor="end">
              {scale}
            </text>
            <text x={LEFT - 6} y={baseline + 4} textAnchor="end">
              0
            </text>
          </g>
          <line x1={LEFT} x2={width} y1={TOP} y2={TOP} className="stroke-border" />
          <line x1={LEFT} x2={width} y1={baseline} y2={baseline} className="stroke-border" />
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
                    fontSize={AXIS_FONT_SIZE}
                    fill="currentColor"
                    className="font-hand text-muted-foreground"
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
