import type { ReviewablePullRequest } from "@/lib/github/pull-requests";
import type { Ticket, TicketPullRequest } from "@/lib/store/tickets";
import { storyIdsIn } from "./story-refs";

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

export function linkPullRequests(
  tickets: Ticket[],
  pullRequests: ReviewablePullRequest[],
): Ticket[] {
  return tickets.map((ticket) => ({
    ...ticket,
    pullRequests: [...ticket.pullRequests, ...mentionedPullRequests(ticket, pullRequests)],
  }));
}
