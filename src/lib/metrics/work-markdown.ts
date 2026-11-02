import { REVIEW_STATUS_LABELS } from "@/lib/review-status";
import { plural } from "@/lib/text";
import {
  cycleTimeMs,
  groupByDay,
  type DraftRow,
  type WorkReport,
  type WorkRow,
  type WorkTotals,
} from "./work";

const HOUR_MS = 60 * 60 * 1000;
const HOURS_BEFORE_DAYS = 48;
const UNKNOWN = "—";
const SEPARATOR = " · ";
const PULL_REQUEST_URL = /\/pull\/(\d+)$/;

export function formatCycleTime(milliseconds: number | null): string {
  if (milliseconds === null) return UNKNOWN;
  const hours = milliseconds / HOUR_MS;
  if (hours < 1) return "under an hour";
  if (hours < HOURS_BEFORE_DAYS) return plural(Math.round(hours), "hour");
  return plural(Math.round(hours / 24), "day");
}

export function prNumber(url: string): string | null {
  const number = PULL_REQUEST_URL.exec(url)?.[1];
  return number === undefined ? null : `#${number}`;
}

function known(parts: (string | null)[]): string[] {
  return parts.filter((part): part is string => part !== null);
}

function cycleOf(verb: string, row: WorkRow): string | null {
  const cycleTime = cycleTimeMs(row);
  return cycleTime === null ? null : `${verb} in ${formatCycleTime(cycleTime)}`;
}

function sizeParts({ additions, deletions, changedFiles }: WorkRow): (string | null)[] {
  if (additions === null || deletions === null || changedFiles === null) return [];
  return [`+${additions} −${deletions}`, plural(changedFiles, "file")];
}

function pullRequestParts(row: WorkRow): (string | null)[] {
  return [row.repo, prNumber(row.url), ...sizeParts(row), cycleOf("merged", row)];
}

function ticketParts(row: WorkRow): (string | null)[] {
  const points = row.points === null ? null : plural(row.points, "point");
  return [`sc-${row.externalId}`, row.storyType, points, cycleOf("finished", row)];
}

export function detailParts(row: WorkRow): string[] {
  return known(row.kind === "pr_merged" ? pullRequestParts(row) : ticketParts(row));
}

function link({ title, url }: { title: string; url: string }): string {
  return `[${title.replace(/[[\]]/g, "\\$&")}](${url})`;
}

function workLine(row: WorkRow): string {
  return `- ${[link(row), ...detailParts(row)].join(SEPARATOR)}`;
}

function draftLine(row: DraftRow): string {
  const status = row.reviewStatus === null ? null : REVIEW_STATUS_LABELS[row.reviewStatus];
  const parts = known([link(row), row.repo, `opened ${row.day}`, status?.toLowerCase() ?? null]);
  return `- ${parts.join(SEPARATOR)}`;
}

function pullRequestTotals(totals: WorkTotals): string {
  const size = `+${totals.additions} −${totals.deletions} across ${plural(totals.changedFiles, "file")}`;
  return known([
    `PRs merged: ${totals.prsMerged}`,
    totals.prsMerged === 0 ? null : size,
    medianOf(totals.medianPrCycleMs),
  ]).join(SEPARATOR);
}

function ticketTotals(totals: WorkTotals): string {
  const types = totals.ticketsByType.map(({ key, count }) => plural(count, key)).join(", ");
  return known([
    `Tickets completed: ${totals.ticketsCompleted}`,
    totals.ticketsCompleted === 0 ? null : plural(totals.points, "point"),
    types === "" ? null : types,
    medianOf(totals.medianTicketCycleMs),
  ]).join(SEPARATOR);
}

function medianOf(milliseconds: number | null): string | null {
  return milliseconds === null ? null : `median cycle time ${formatCycleTime(milliseconds)}`;
}

function uncountedParts(totals: WorkTotals): string[] {
  return known([
    totals.prsWithoutSize === 0 ? null : `${plural(totals.prsWithoutSize, "PR")} without size data`,
    totals.unestimatedTickets === 0
      ? null
      : `${plural(totals.unestimatedTickets, "ticket")} without an estimate`,
  ]);
}

function summaryLines(totals: WorkTotals): string[] {
  const uncounted = uncountedParts(totals);
  return [
    `- ${pullRequestTotals(totals)}`,
    `- ${ticketTotals(totals)}`,
    ...(uncounted.length === 0 ? [] : [`- Not counted: ${uncounted.join(", ")}`]),
  ];
}

export function leadSentence(totals: WorkTotals): string {
  return `${plural(totals.prsMerged, "PR")} merged and ${plural(totals.ticketsCompleted, "ticket")} completed`;
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body === "" ? "None" : body}\n`;
}

function byDay(rows: WorkRow[]): string {
  return groupByDay(rows)
    .map(({ day, rows: dayRows }) => `### ${day}\n\n${dayRows.map(workLine).join("\n")}`)
    .join("\n\n");
}

export function workMarkdown(report: WorkReport): string {
  const { from, to, totals, prs, tickets, drafts } = report;
  return [
    `# Work log: ${from} to ${to}\n`,
    `${leadSentence(totals)}.\n`,
    section("Summary", summaryLines(totals).join("\n")),
    section(`PRs merged (${prs.length})`, byDay(prs)),
    section(`Tickets completed (${tickets.length})`, byDay(tickets)),
    section(`Drafts in progress (${drafts.length})`, drafts.map(draftLine).join("\n")),
  ].join("\n");
}
