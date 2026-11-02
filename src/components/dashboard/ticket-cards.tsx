import type { Summary } from "@/lib/metrics/summary";
import type { OpenItem } from "@/lib/store/open-items";
import type { Ticket, TicketPullRequest } from "@/lib/store/tickets";

const ACCENT_BY_STORY_TYPE: Record<string, string> = {
  feature: "border-l-story-feature",
  bug: "border-l-story-bug",
  chore: "border-l-story-chore",
};

const DEFAULT_ACCENT = "border-l-rule";

function accentFor(storyType: string | null): string {
  return (storyType && ACCENT_BY_STORY_TYPE[storyType]) || DEFAULT_ACCENT;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function estimateText(estimate: number): string {
  return estimate === 1 ? "1 point" : `${estimate} points`;
}

function pullRequestStatus(pullRequest: TicketPullRequest): string {
  if (pullRequest.isMerged) return "PR merged";
  if (pullRequest.isDraft) return "Draft PR";
  return "PR open";
}

function PullRequestStatus({ pullRequests }: { pullRequests: TicketPullRequest[] }) {
  if (pullRequests.length === 0) return <span className="text-sm text-ink-soft">No PR yet</span>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {pullRequests.map((pullRequest) => (
        <li key={pullRequest.url}>
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {pullRequestStatus(pullRequest)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
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
      <div className="mt-auto flex flex-wrap items-start justify-between gap-3">
        <span className="rounded-full border border-rule px-2 py-0.5 text-sm">{ticket.state}</span>
        <PullRequestStatus pullRequests={ticket.pullRequests} />
      </div>
    </article>
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

export function TicketCards({ open }: { open: Summary["open"] }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Your tickets" className="flex flex-col gap-3">
        <h2 className="font-semibold">Your tickets</h2>
        {open.tickets.length === 0 ? (
          <p className="text-ink-soft">No tickets assigned to you</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {open.tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </section>
      <UnlinkedPullRequests items={unlinkedPullRequests(open)} />
    </div>
  );
}
