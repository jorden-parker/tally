import { plural } from "@/lib/text";
import { cycleTimeMs, type DraftRow, type WorkReport, type WorkRow, type WorkTotals } from "./work";

const HOUR_MS = 60 * 60 * 1000;
const HOURS_BEFORE_DAYS = 48;
const UNKNOWN = "—";

export function formatCycleTime(milliseconds: number | null): string {
  if (milliseconds === null) return UNKNOWN;
  const hours = milliseconds / HOUR_MS;
  if (hours < 1) return "under an hour";
  if (hours < HOURS_BEFORE_DAYS) return plural(Math.round(hours), "hour");
  return plural(Math.round(hours / 24), "day");
}

function joinKnown(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join(" · ") || UNKNOWN;
}

function sizeOf({ additions, deletions, changedFiles }: WorkRow): string | null {
  if (additions === null || deletions === null || changedFiles === null) return null;
  return `+${additions} −${deletions}, ${plural(changedFiles, "file")}`;
}

function cycleOf(verb: string, row: WorkRow): string | null {
  const cycleTime = cycleTimeMs(row);
  return cycleTime === null ? null : `${verb} in ${formatCycleTime(cycleTime)}`;
}

export function prDetail(row: WorkRow): string {
  return joinKnown([sizeOf(row), cycleOf("merged", row)]);
}

export function ticketDetail(row: WorkRow): string {
  const points = row.points === null ? null : plural(row.points, "point");
  return joinKnown([row.storyType, points, cycleOf("finished", row)]);
}

function link({ title, url }: { title: string; url: string }): string {
  return `[${title.replace(/[[\]]/g, "\\$&")}](${url})`;
}

function repoSuffix(repo: string | null): string {
  return repo === null ? "" : ` (${repo})`;
}

function workLine(row: WorkRow, detail: string): string {
  return `- ${row.day} ${link(row)}${repoSuffix(row.repo)}: ${detail}`;
}

function draftLine(row: DraftRow): string {
  return `- Opened ${row.day} ${link(row)}${repoSuffix(row.repo)}`;
}

function summaryLines(totals: WorkTotals): string[] {
  const size = `+${totals.additions} −${totals.deletions} across ${plural(totals.changedFiles, "file")}`;
  const prNotes = [size];
  if (totals.prsWithoutSize > 0) {
    prNotes.push(`${plural(totals.prsWithoutSize, "PR")} without size data`);
  }
  const ticketNotes = [plural(totals.points, "point")];
  if (totals.unestimatedTickets > 0) ticketNotes.push(`${totals.unestimatedTickets} unestimated`);
  const types = totals.ticketsByType.map(({ key, count }) => `${count} ${key}`).join(", ");
  return [
    `- PRs merged: ${totals.prsMerged} (${prNotes.join(", ")})`,
    `- Tickets completed: ${totals.ticketsCompleted} (${ticketNotes.join(", ")})`,
    ...(types === "" ? [] : [`- Ticket types: ${types}`]),
    `- Median cycle time: PRs ${formatCycleTime(totals.medianPrCycleMs)}, tickets ${formatCycleTime(totals.medianTicketCycleMs)}`,
  ];
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n\n${lines.length === 0 ? "None" : lines.join("\n")}\n`;
}

export function workMarkdown(report: WorkReport): string {
  const { from, to, totals, prs, tickets, drafts } = report;
  return [
    `# Work log: ${from} to ${to}\n`,
    section("Summary", summaryLines(totals)),
    section(
      "PRs merged",
      prs.map((row) => workLine(row, prDetail(row))),
    ),
    section(
      "Tickets completed",
      tickets.map((row) => workLine(row, ticketDetail(row))),
    ),
    section("Draft PRs (current)", drafts.map(draftLine)),
  ].join("\n");
}
