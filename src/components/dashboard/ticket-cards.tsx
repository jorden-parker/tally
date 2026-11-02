import { dayKey } from "@/lib/metrics/buckets";
import type { Range, Summary } from "@/lib/metrics/summary";
import { REVIEW_STATUS_LABELS } from "@/lib/review-status";
import type { OpenItem } from "@/lib/store/open-items";
import type { ReviewStatus } from "@/lib/store/pull-request-reviews";
import type { Ticket, TicketPullRequest } from "@/lib/store/tickets";
import { formatLongDay, rangePhrase } from "./format";

type StatusLabels = Record<ReviewStatus, string>;

const REVIEWER_LABELS: StatusLabels = {
  awaiting_review: "Awaiting your review",
  in_review: "You are reviewing",
  changes_requested: "You requested changes",
  approved: "Approved",
};

const ACCENT_BY_STORY_TYPE: Record<string, string> = {
  feature: "border-l-story-feature",
  bug: "border-l-story-bug",
  chore: "border-l-story-chore",
};

const DEFAULT_ACCENT = "border-l-rule";

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function accentFor(storyType: string | null): string {
  return (storyType && ACCENT_BY_STORY_TYPE[storyType]) || DEFAULT_ACCENT;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function estimateText(estimate: number): string {
  return estimate === 1 ? "1 point" : `${estimate} points`;
}

function pullRequestStatus(pullRequest: TicketPullRequest, labels: StatusLabels): string {
  if (pullRequest.isMerged) return "PR merged";
  if (pullRequest.isDraft) return "Draft PR";
  return pullRequest.reviewStatus === null ? "PR open" : labels[pullRequest.reviewStatus];
}

const GITHUB_PULL_REQUEST_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/;

function pullRequestReference(url: string): string {
  const match = GITHUB_PULL_REQUEST_URL.exec(url);
  return match ? `${match[1]} #${match[2]}` : new URL(url).pathname;
}

function completedText(completedAt: string): string {
  return `Completed ${formatLongDay(dayKey(completedAt, LOCAL_TIME_ZONE))}`;
}

function PullRequestStatus({
  pullRequests,
  labels,
}: {
  pullRequests: TicketPullRequest[];
  labels: StatusLabels;
}) {
  if (pullRequests.length === 0) return <span className="text-sm text-ink-soft">No PR yet</span>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {pullRequests.map((pullRequest) => (
        <li key={pullRequest.url} className="flex flex-col">
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {pullRequest.title}
          </a>
          <span className="text-ink-soft">
            {pullRequestReference(pullRequest.url)} · {pullRequestStatus(pullRequest, labels)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TicketCard({ ticket, labels }: { ticket: Ticket; labels: StatusLabels }) {
  const label = `sc-${ticket.id}`;
  return (
    <article
      aria-label={label}
      className={`flex flex-col gap-3 rounded-md border border-rule border-l-4 p-4 ${accentFor(ticket.storyType)}`}
    >
      <div className="flex items-baseline justify-between gap-3 text-sm text-ink-soft">
        <span className="flex gap-2">
          <span>{label}</span>
          {ticket.storyType ? <span>{capitalise(ticket.storyType)}</span> : null}
        </span>
        {ticket.estimate === null ? null : <span>{estimateText(ticket.estimate)}</span>}
      </div>
      <a
        href={ticket.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {ticket.title}
      </a>
      {ticket.role === "reviewing" ? (
        <span className="text-sm text-ink-soft">Owned by {ticket.owners.join(", ")}</span>
      ) : null}
      {ticket.role === "completed" && ticket.completedAt !== null ? (
        <span className="text-sm text-ink-soft">{completedText(ticket.completedAt)}</span>
      ) : null}
      <div className="mt-auto flex flex-wrap items-start justify-between gap-3">
        <span className="rounded-full border border-rule px-2 py-0.5 text-sm">{ticket.state}</span>
        <PullRequestStatus pullRequests={ticket.pullRequests} labels={labels} />
      </div>
    </article>
  );
}

function CardSection({
  title,
  emptyText,
  tickets,
  labels = REVIEW_STATUS_LABELS,
}: {
  title: string;
  emptyText: string;
  tickets: Ticket[];
  labels?: StatusLabels;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-semibold">{title}</h2>
      {tickets.length === 0 ? (
        <p className="text-ink-soft">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} labels={labels} />
          ))}
        </div>
      )}
    </section>
  );
}

function UnlinkedPullRequest({ item }: { item: OpenItem }) {
  return (
    <li className="flex flex-col">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {item.title}
      </a>
      {item.isDraft ? <span className="text-sm text-ink-soft">Draft</span> : null}
      {item.reviewStatus === null ? null : (
        <span className="text-sm text-ink-soft">{REVIEW_STATUS_LABELS[item.reviewStatus]}</span>
      )}
      {item.repo ? <span className="text-sm text-ink-soft">{item.repo}</span> : null}
    </li>
  );
}

function unlinkedPullRequests(open: Summary["open"]): OpenItem[] {
  const linked = new Set(
    open.tickets.flatMap((ticket) => ticket.pullRequests.map((pullRequest) => pullRequest.url)),
  );
  return open.prs.filter((item) => !linked.has(item.url));
}

function UnlinkedPullRequests({ items }: { items: OpenItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Open PRs without a ticket" className="flex flex-col gap-3">
      <h3 className="font-semibold">Open PRs without a ticket</h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <UnlinkedPullRequest key={item.externalId} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function TicketCards({
  open,
  completedTickets,
  range,
}: {
  open: Summary["open"];
  completedTickets: Ticket[];
  range: Range;
}) {
  const phrase = rangePhrase(range);
  return (
    <div className="flex flex-col gap-8">
      <CardSection
        title="Your tickets"
        emptyText="No tickets assigned to you"
        tickets={open.tickets}
      />
      <UnlinkedPullRequests items={unlinkedPullRequests(open)} />
      <CardSection
        title="Reviewing"
        emptyText="Nothing waiting for your review"
        tickets={open.reviewing}
        labels={REVIEWER_LABELS}
      />
      <CardSection
        title={`Completed ${phrase}`}
        emptyText={`Nothing completed ${phrase}`}
        tickets={completedTickets}
      />
    </div>
  );
}
