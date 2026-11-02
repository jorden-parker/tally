import type { ReviewablePullRequest } from "@/lib/github/pull-requests";
import type { Ticket, TicketPullRequest } from "@/lib/store/tickets";
import { storyIdsIn } from "./story-refs";

export type PullRequestsByRole = {
  authored: ReviewablePullRequest[];
  toReview: ReviewablePullRequest[];
  mergedUrls: string[];
};

function toTicketPullRequest(pullRequest: ReviewablePullRequest): TicketPullRequest {
  return {
    url: pullRequest.url,
    title: pullRequest.title,
    isDraft: pullRequest.isDraft,
    isMerged: false,
    reviewStatus: pullRequest.reviewStatus,
  };
}

function mentionedPullRequests(
  ticket: Ticket,
  pullRequests: ReviewablePullRequest[],
): TicketPullRequest[] {
  const attached = new Set(ticket.pullRequests.map((pullRequest) => pullRequest.url));
  return pullRequests
    .filter((pullRequest) => !attached.has(pullRequest.url))
    .filter((pullRequest) =>
      storyIdsIn(`${pullRequest.headRefName} ${pullRequest.title}`).includes(ticket.id),
    )
    .map(toTicketPullRequest);
}

function linkReviewingTicket(ticket: Ticket, { authored, toReview }: PullRequestsByRole): Ticket {
  return {
    ...ticket,
    pullRequests: [
      ...ticket.pullRequests,
      ...mentionedPullRequests(ticket, [...authored, ...toReview]),
    ],
  };
}

function linkOwnTicket(ticket: Ticket, { authored, mergedUrls }: PullRequestsByRole): Ticket {
  const mine = new Set([...authored.map((pullRequest) => pullRequest.url), ...mergedUrls]);
  const attached = ticket.pullRequests.filter((pullRequest) => mine.has(pullRequest.url));
  return { ...ticket, pullRequests: [...attached, ...mentionedPullRequests(ticket, authored)] };
}

export function linkPullRequests(tickets: Ticket[], pullRequests: PullRequestsByRole): Ticket[] {
  return tickets.map((ticket) =>
    ticket.role === "reviewing"
      ? linkReviewingTicket(ticket, pullRequests)
      : linkOwnTicket(ticket, pullRequests),
  );
}
