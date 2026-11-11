import { EmptyNote, SectionHeading } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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

const DOT_BY_STORY_TYPE: Record<string, string> = {
  feature: "bg-story-feature",
  bug: "bg-story-bug",
  chore: "bg-story-chore",
};

const DEFAULT_DOT = "bg-muted-foreground";

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const TITLE_LINK_CLASS = "font-medium underline-offset-4 hover:underline";

function dotFor(storyType: string | null): string {
  return (storyType && DOT_BY_STORY_TYPE[storyType]) || DEFAULT_DOT;
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
  if (pullRequests.length === 0)
    return <span className="text-sm text-muted-foreground">No PR yet, still brewing</span>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {pullRequests.map((pullRequest) => (
        <li key={pullRequest.url} className="flex flex-col gap-0.5">
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {pullRequest.title}
          </a>
          <span className="font-mono text-xs text-muted-foreground">
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
    <article aria-label={label} className="flex">
      <Card className="flex-1 transition-colors hover:ring-foreground/25">
        <CardHeader className="flex items-center justify-between gap-3 text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{label}</span>
            {ticket.storyType ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${dotFor(ticket.storyType)}`}
                />
                {capitalise(ticket.storyType)}
              </span>
            ) : null}
          </span>
          {ticket.estimate === null ? null : (
            <span className="text-xs">{estimateText(ticket.estimate)}</span>
          )}
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2">
          <a href={ticket.url} target="_blank" rel="noreferrer" className={TITLE_LINK_CLASS}>
            {ticket.title}
          </a>
          {ticket.role === "reviewing" ? (
            <span className="text-sm text-muted-foreground">
              Owned by {ticket.owners.join(", ")}
            </span>
          ) : null}
          {ticket.role === "completed" && ticket.completedAt !== null ? (
            <span className="text-sm text-muted-foreground">
              {completedText(ticket.completedAt)}
            </span>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-start gap-3 bg-muted">
          <Badge variant="outline">{ticket.state}</Badge>
          <PullRequestStatus pullRequests={ticket.pullRequests} labels={labels} />
        </CardFooter>
      </Card>
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
    <section aria-label={title} className="flex flex-col gap-4">
      <SectionHeading title={title} />
      {tickets.length === 0 ? (
        <EmptyNote>{emptyText}</EmptyNote>
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
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <a href={item.url} target="_blank" rel="noreferrer" className={TITLE_LINK_CLASS}>
        {item.title}
      </a>
      {item.isDraft ? <Badge variant="secondary">Draft</Badge> : null}
      {item.reviewStatus === null ? null : (
        <span className="text-sm text-muted-foreground">
          {REVIEW_STATUS_LABELS[item.reviewStatus]}
        </span>
      )}
      {item.repo ? (
        <span className="font-mono text-xs text-muted-foreground">{item.repo}</span>
      ) : null}
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
    <section aria-label="Open PRs without a ticket" className="flex flex-col gap-4">
      <SectionHeading title="Open PRs without a ticket" level={3} />
      <ul className="divide-y rounded-xl border bg-card">
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
    <div className="flex flex-col gap-14">
      <CardSection
        title="Your tickets"
        emptyText="Your desk is clear. Suspiciously clear."
        tickets={open.tickets}
      />
      <UnlinkedPullRequests items={unlinkedPullRequests(open)} />
      <CardSection
        title="Reviewing"
        emptyText="Nobody needs your eyes right now."
        tickets={open.reviewing}
        labels={REVIEWER_LABELS}
      />
      <CardSection
        title={`Completed ${phrase}`}
        emptyText={`Nothing ticked off ${phrase}. Yet.`}
        tickets={completedTickets}
      />
    </div>
  );
}
