import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Summary } from "@/lib/metrics/summary";
import type { OpenItem } from "@/lib/store/open-items";
import type { Ticket, TicketPullRequest } from "@/lib/store/tickets";
import { makeSummary, makeTicket } from "@/test/fake-api";
import { TicketCards } from "./ticket-cards";

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

function card(id: string): HTMLElement {
  return screen.getByRole("article", { name: `sc-${id}` });
}

function openPr(number: number, overrides: Partial<OpenItem> = {}): OpenItem {
  return {
    source: "github",
    externalId: `https://github.com/acme/api/pull/${number}`,
    openedAt: "2026-10-20T10:00:00Z",
    isDraft: false,
    repo: "acme/api",
    title: `PR ${number}`,
    url: `https://github.com/acme/api/pull/${number}`,
    reviewStatus: null,
    ...overrides,
  };
}

const PULL_REQUEST: TicketPullRequest = {
  url: "https://github.com/acme/api/pull/9",
  title: "Roll out",
  isDraft: false,
  isMerged: false,
  reviewStatus: null,
};

function renderCards({
  prs = [],
  tickets = [],
  reviewing = [],
  completedTickets = [],
  range = "week",
}: Partial<Summary["open"]> & Partial<Pick<Summary, "completedTickets" | "range">>) {
  return render(
    <TicketCards
      open={{ prs, tickets, reviewing }}
      completedTickets={completedTickets}
      range={range}
    />,
  );
}

function withStatus(id: string, reviewStatus: TicketPullRequest["reviewStatus"]): Ticket {
  return makeTicket({ id, pullRequests: [{ ...PULL_REQUEST, reviewStatus }] });
}

describe("TicketCards", () => {
  it("shows the id, type, state, estimate and a link for each ticket", () => {
    const summary = makeSummary();
    render(
      <TicketCards
        open={summary.open}
        completedTickets={summary.completedTickets}
        range={summary.range}
      />,
    );

    const ticket = card("31");
    expect(within(ticket).getByText("sc-31")).toBeDefined();
    expect(within(ticket).getByText("Feature")).toBeDefined();
    expect(within(ticket).getByText("In Progress")).toBeDefined();
    expect(within(ticket).getByText("3 points")).toBeDefined();
    const link = within(ticket).getByRole("link", { name: "Plan the rollout" });
    expect(link.getAttribute("href")).toBe("https://app.shortcut.com/acme/story/31");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("says a ticket has no PR yet", () => {
    renderCards({ tickets: [makeTicket()] });

    expect(within(card("31")).getByText("No PR yet")).toBeDefined();
  });

  it("links a draft PR, an open PR and a merged PR with their status", () => {
    const tickets = [
      makeTicket({ id: "1", pullRequests: [{ ...PULL_REQUEST, isDraft: true }] }),
      makeTicket({ id: "2", pullRequests: [PULL_REQUEST] }),
      makeTicket({ id: "3", pullRequests: [{ ...PULL_REQUEST, isMerged: true }] }),
    ];

    renderCards({ tickets });

    const draft = within(card("1")).getByRole("link", { name: "Roll out" });
    expect(draft.getAttribute("href")).toBe("https://github.com/acme/api/pull/9");
    expect(draft.getAttribute("target")).toBe("_blank");
    expect(within(card("1")).getByText("acme/api #9 · Draft PR")).toBeDefined();
    expect(within(card("2")).getByText("acme/api #9 · PR open")).toBeDefined();
    expect(within(card("3")).getByText("acme/api #9 · PR merged")).toBeDefined();
  });

  it("falls back to the url path when a PR is not on GitHub", () => {
    renderCards({
      tickets: [makeTicket({ pullRequests: [{ ...PULL_REQUEST, url: "https://x/pulls/2" }] })],
    });

    expect(within(card("31")).getByText("/pulls/2 · PR open")).toBeDefined();
  });

  it("labels my PRs with their review status", () => {
    renderCards({
      tickets: [
        withStatus("1", "awaiting_review"),
        withStatus("2", "in_review"),
        withStatus("3", "changes_requested"),
        withStatus("4", "approved"),
      ],
    });

    expect(within(card("1")).getByText("acme/api #9 · Awaiting review")).toBeDefined();
    expect(within(card("2")).getByText("acme/api #9 · In review")).toBeDefined();
    expect(within(card("3")).getByText("acme/api #9 · Changes requested")).toBeDefined();
    expect(within(card("4")).getByText("acme/api #9 · Approved")).toBeDefined();
  });

  it("prefers the draft and merged labels over the review status", () => {
    renderCards({
      tickets: [
        makeTicket({
          id: "1",
          pullRequests: [{ ...PULL_REQUEST, isDraft: true, reviewStatus: "approved" }],
        }),
        makeTicket({
          id: "2",
          pullRequests: [{ ...PULL_REQUEST, isMerged: true, reviewStatus: "approved" }],
        }),
      ],
    });

    expect(within(card("1")).getByText("acme/api #9 · Draft PR")).toBeDefined();
    expect(within(card("2")).getByText("acme/api #9 · PR merged")).toBeDefined();
  });

  it("lists one line per PR when a ticket has several", () => {
    const tickets = [
      makeTicket({
        pullRequests: [
          PULL_REQUEST,
          { ...PULL_REQUEST, url: "https://github.com/acme/web/pull/2", isMerged: true },
        ],
      }),
    ];

    renderCards({ tickets });

    expect(within(card("31")).getAllByRole("link", { name: "Roll out" })).toHaveLength(2);
    expect(within(card("31")).getByText("acme/api #9 · PR open")).toBeDefined();
    expect(within(card("31")).getByText("acme/web #2 · PR merged")).toBeDefined();
  });

  it("leaves out the estimate and type when Shortcut has none", () => {
    renderCards({ tickets: [makeTicket({ estimate: null, storyType: null })] });

    expect(within(card("31")).queryByText(/points?/)).toBeNull();
    expect(within(card("31")).queryByText("Feature")).toBeNull();
  });

  it("singularises a one-point estimate", () => {
    renderCards({ tickets: [makeTicket({ estimate: 1 })] });

    expect(within(card("31")).getByText("1 point")).toBeDefined();
  });

  it("lists open PRs that no ticket links to, with their draft flag and review status", () => {
    const tickets = [makeTicket({ pullRequests: [PULL_REQUEST] })];
    const prs = [
      openPr(9),
      openPr(4, { isDraft: true }),
      openPr(5, { reviewStatus: "changes_requested" }),
    ];

    renderCards({ prs, tickets });

    const unlinked = section("Open PRs without a ticket");
    expect(unlinked.tagName).toBe("SECTION");
    expect(
      within(unlinked)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["PR 4", "PR 5"]);
    expect(within(unlinked).getAllByText("Draft")).toHaveLength(1);
    expect(within(unlinked).getByText("Changes requested")).toBeDefined();
    expect(within(unlinked).getAllByText("acme/api")).toHaveLength(2);
  });

  it("omits the unlinked list when every open PR belongs to a ticket", () => {
    const tickets = [makeTicket({ pullRequests: [PULL_REQUEST] })];

    renderCards({ prs: [openPr(9)], tickets });

    expect(screen.queryByRole("region", { name: "Open PRs without a ticket" })).toBeNull();
  });

  it("says when there are no tickets", () => {
    renderCards({});

    expect(within(section("Your tickets")).getByText("No tickets assigned to you")).toBeDefined();
  });

  describe("reviewing", () => {
    function reviewing(id: string, reviewStatus: TicketPullRequest["reviewStatus"]): Ticket {
      return makeTicket({
        id,
        role: "reviewing",
        owners: ["Ada", "Grace"],
        pullRequests: [{ ...PULL_REQUEST, reviewStatus }],
      });
    }

    it("shows other people's tickets with their owners and the status from my side", () => {
      renderCards({
        reviewing: [
          reviewing("1", "awaiting_review"),
          reviewing("2", "in_review"),
          reviewing("3", "changes_requested"),
        ],
      });

      const region = section("Reviewing");
      expect(within(region).getAllByText("Owned by Ada, Grace")).toHaveLength(3);
      expect(within(card("1")).getByText("acme/api #9 · Awaiting your review")).toBeDefined();
      expect(within(card("2")).getByText("acme/api #9 · You are reviewing")).toBeDefined();
      expect(within(card("3")).getByText("acme/api #9 · You requested changes")).toBeDefined();
    });

    it("says when nothing is waiting", () => {
      renderCards({});

      expect(
        within(section("Reviewing")).getByText("Nothing waiting for your review"),
      ).toBeDefined();
    });
  });

  describe("completed", () => {
    const completed = makeTicket({
      id: "21",
      role: "completed",
      state: "Done",
      completedAt: "2026-10-29T12:00:00Z",
    });

    it("names the range in the heading and dates each card", () => {
      renderCards({ completedTickets: [completed], range: "week" });

      const region = section("Completed this week");
      expect(within(region).getByRole("heading", { name: "Completed this week" })).toBeDefined();
      expect(within(card("21")).getByText("Completed Thu 29 Oct")).toBeDefined();
    });

    it.each([
      ["day", "Nothing completed today"],
      ["30d", "Nothing completed last 30 days"],
    ] as const)("says when nothing was completed for %s", (range, text) => {
      renderCards({ range });

      expect(screen.getByText(text)).toBeDefined();
    });
  });
});
