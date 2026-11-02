import type { DatabaseSync } from "node:sqlite";
import { reviewStatusJoin, toReviewStatus, type ReviewStatus } from "./pull-request-reviews";

export type TicketPullRequest = {
  url: string;
  title: string;
  isDraft: boolean;
  isMerged: boolean;
  reviewStatus: ReviewStatus | null;
};

export type TicketRole = "assigned" | "reviewing" | "completed";

export type Ticket = {
  id: string;
  title: string;
  url: string;
  openedAt: string;
  storyType: string | null;
  state: string;
  estimate: number | null;
  role: TicketRole;
  completedAt: string | null;
  owners: string[];
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
  role: TicketRole;
  completed_at: string | null;
};

type PullRequestRow = {
  ticket_id: string;
  url: string;
  title: string;
  is_draft: number;
  is_merged: number;
  review_status: string | null;
};

type OwnerRow = { ticket_id: string; name: string };

const DEFAULT_ROLE: TicketRole = "assigned";

const DELETE_STATEMENTS = [
  `DELETE FROM ticket_pull_requests`,
  `DELETE FROM ticket_owners`,
  `DELETE FROM ticket_roles`,
  `DELETE FROM tickets`,
];

const INSERT_TICKET = `
  INSERT INTO tickets (id, title, url, opened_at, story_type, state, estimate)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const INSERT_ROLE = `INSERT INTO ticket_roles (ticket_id, role, completed_at) VALUES (?, ?, ?)`;

const INSERT_OWNER = `INSERT INTO ticket_owners (ticket_id, name) VALUES (?, ?)`;

const INSERT_PULL_REQUEST = `
  INSERT INTO ticket_pull_requests (ticket_id, url, title, is_draft, is_merged)
  VALUES (?, ?, ?, ?, ?)
`;

const ALL_TICKETS = `
  SELECT
    id, title, url, opened_at, story_type, state, estimate,
    COALESCE(ticket_roles.role, '${DEFAULT_ROLE}') AS role,
    ticket_roles.completed_at
  FROM tickets
  LEFT JOIN ticket_roles ON ticket_roles.ticket_id = tickets.id
  ORDER BY opened_at DESC, id ASC
`;

const ALL_PULL_REQUESTS = `
  SELECT
    ticket_id, ticket_pull_requests.url, title, is_draft, is_merged,
    pull_request_reviews.status AS review_status
  FROM ticket_pull_requests
  ${reviewStatusJoin("ticket_pull_requests")}
  ORDER BY ticket_id ASC, ticket_pull_requests.url ASC
`;

const ALL_OWNERS = `SELECT ticket_id, name FROM ticket_owners ORDER BY ticket_id ASC, name ASC`;

function toPullRequest(row: PullRequestRow): TicketPullRequest {
  return {
    url: row.url,
    title: row.title,
    isDraft: row.is_draft === 1,
    isMerged: row.is_merged === 1,
    reviewStatus: toReviewStatus(row.review_status),
  };
}

function toTicket(row: TicketRow, owners: string[], pullRequests: TicketPullRequest[]): Ticket {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    openedAt: row.opened_at,
    storyType: row.story_type,
    state: row.state,
    estimate: row.estimate,
    role: row.role,
    completedAt: row.completed_at,
    owners,
    pullRequests,
  };
}

function groupByTicket<Row extends { ticket_id: string }, Value>(
  rows: Row[],
  toValue: (row: Row) => Value,
): Map<string, Value[]> {
  const groups = new Map<string, Value[]>();
  for (const row of rows) {
    const existing = groups.get(row.ticket_id) ?? [];
    groups.set(row.ticket_id, [...existing, toValue(row)]);
  }
  return groups;
}

function insertTicket(db: DatabaseSync, ticket: Ticket): void {
  db.prepare(INSERT_TICKET).run(
    ticket.id,
    ticket.title,
    ticket.url,
    ticket.openedAt,
    ticket.storyType,
    ticket.state,
    ticket.estimate,
  );
  db.prepare(INSERT_ROLE).run(ticket.id, ticket.role, ticket.completedAt);
  const ownerStatement = db.prepare(INSERT_OWNER);
  for (const owner of ticket.owners) ownerStatement.run(ticket.id, owner);
  const pullRequestStatement = db.prepare(INSERT_PULL_REQUEST);
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

export function replaceTickets(db: DatabaseSync, tickets: Ticket[]): void {
  for (const statement of DELETE_STATEMENTS) db.prepare(statement).run();
  for (const ticket of tickets) insertTicket(db, ticket);
}

export function loadTickets(db: DatabaseSync): Ticket[] {
  const pullRequests = groupByTicket(
    db.prepare(ALL_PULL_REQUESTS).all() as PullRequestRow[],
    toPullRequest,
  );
  const owners = groupByTicket(db.prepare(ALL_OWNERS).all() as OwnerRow[], (row) => row.name);
  const rows = db.prepare(ALL_TICKETS).all() as TicketRow[];
  return rows.map((row) => toTicket(row, owners.get(row.id) ?? [], pullRequests.get(row.id) ?? []));
}
