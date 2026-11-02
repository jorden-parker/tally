import type { DatabaseSync } from "node:sqlite";

export type TicketPullRequest = {
  url: string;
  title: string;
  isDraft: boolean;
  isMerged: boolean;
};

export type Ticket = {
  id: string;
  title: string;
  url: string;
  openedAt: string;
  storyType: string | null;
  state: string;
  estimate: number | null;
  pullRequests: TicketPullRequest[];
};

type TicketRow = {
  id: string;
  title: string;
  url: string;
  opened_at: string;
  story_type: string | null;
  state: string;
  estimate: number | null;
};

type PullRequestRow = {
  ticket_id: string;
  url: string;
  title: string;
  is_draft: number;
  is_merged: number;
};

const DELETE_TICKETS = `DELETE FROM tickets`;

const DELETE_PULL_REQUESTS = `DELETE FROM ticket_pull_requests`;

const INSERT_TICKET = `
  INSERT INTO tickets (id, title, url, opened_at, story_type, state, estimate)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_PULL_REQUEST = `
  INSERT INTO ticket_pull_requests (ticket_id, url, title, is_draft, is_merged)
  VALUES (?, ?, ?, ?, ?)
`;

const ALL_TICKETS = `
  SELECT id, title, url, opened_at, story_type, state, estimate
  FROM tickets
  ORDER BY opened_at DESC, id ASC
`;

const ALL_PULL_REQUESTS = `
  SELECT ticket_id, url, title, is_draft, is_merged
  FROM ticket_pull_requests
  ORDER BY ticket_id ASC, url ASC
`;

function toPullRequest(row: PullRequestRow): TicketPullRequest {
  return {
    url: row.url,
    title: row.title,
    isDraft: row.is_draft === 1,
    isMerged: row.is_merged === 1,
  };
}

function toTicket(row: TicketRow, pullRequests: TicketPullRequest[]): Ticket {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    openedAt: row.opened_at,
    storyType: row.story_type,
    state: row.state,
    estimate: row.estimate,
    pullRequests,
  };
}

export function replaceTickets(db: DatabaseSync, tickets: Ticket[]): void {
  db.prepare(DELETE_PULL_REQUESTS).run();
  db.prepare(DELETE_TICKETS).run();
  const ticketStatement = db.prepare(INSERT_TICKET);
  const pullRequestStatement = db.prepare(INSERT_PULL_REQUEST);
  for (const ticket of tickets) {
    ticketStatement.run(
      ticket.id,
      ticket.title,
      ticket.url,
      ticket.openedAt,
      ticket.storyType,
      ticket.state,
      ticket.estimate,
    );
    for (const pullRequest of ticket.pullRequests) {
      pullRequestStatement.run(
        ticket.id,
        pullRequest.url,
        pullRequest.title,
        pullRequest.isDraft ? 1 : 0,
        pullRequest.isMerged ? 1 : 0,
      );
    }
  }
}

export function loadTickets(db: DatabaseSync): Ticket[] {
  const pullRequestsByTicket = new Map<string, TicketPullRequest[]>();
  for (const row of db.prepare(ALL_PULL_REQUESTS).all() as PullRequestRow[]) {
    const existing = pullRequestsByTicket.get(row.ticket_id) ?? [];
    pullRequestsByTicket.set(row.ticket_id, [...existing, toPullRequest(row)]);
  }
  const rows = db.prepare(ALL_TICKETS).all() as TicketRow[];
  return rows.map((row) => toTicket(row, pullRequestsByTicket.get(row.id) ?? []));
}
