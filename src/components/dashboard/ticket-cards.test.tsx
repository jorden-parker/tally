import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OpenItem } from "@/lib/store/open-items";
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
    ...overrides,
  };
}

const PULL_REQUEST = {
  url: "https://github.com/acme/api/pull/9",
  title: "Roll out",
  isDraft: false,
  isMerged: false,
};

describe("TicketCards", () => {
  it("shows the id, type, state, estimate and a link for each ticket", () => {
    render(<TicketCards open={makeSummary().open} />);

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
    render(<TicketCards open={{ prs: [], tickets: [makeTicket()] }} />);

    expect(within(card("31")).getByText("No PR yet")).toBeDefined();
  });

  it("links a draft PR, an open PR and a merged PR with their status", () => {
    const tickets = [
      makeTicket({ id: "1", pullRequests: [{ ...PULL_REQUEST, isDraft: true }] }),
      makeTicket({ id: "2", pullRequests: [PULL_REQUEST] }),
      makeTicket({ id: "3", pullRequests: [{ ...PULL_REQUEST, isMerged: true }] }),
    ];

    render(<TicketCards open={{ prs: [], tickets }} />);

    const draft = within(card("1")).getByRole("link", { name: "Draft PR" });
    expect(draft.getAttribute("href")).toBe("https://github.com/acme/api/pull/9");
    expect(within(card("2")).getByRole("link", { name: "PR open" })).toBeDefined();
    expect(within(card("3")).getByRole("link", { name: "PR merged" })).toBeDefined();
  });

  it("lists one line per PR when a ticket has several", () => {
    const tickets = [
      makeTicket({
        pullRequests: [PULL_REQUEST, { ...PULL_REQUEST, url: "https://x/2", isMerged: true }],
      }),
    ];

    render(<TicketCards open={{ prs: [], tickets }} />);

    expect(within(card("31")).getByRole("link", { name: "PR open" })).toBeDefined();
    expect(within(card("31")).getByRole("link", { name: "PR merged" })).toBeDefined();
  });

  it("leaves out the estimate and type when Shortcut has none", () => {
    render(
      <TicketCards
        open={{ prs: [], tickets: [makeTicket({ estimate: null, storyType: null })] }}
      />,
    );

    expect(within(card("31")).queryByText(/points?/)).toBeNull();
    expect(within(card("31")).queryByText("Feature")).toBeNull();
  });

  it("singularises a one-point estimate", () => {
    render(<TicketCards open={{ prs: [], tickets: [makeTicket({ estimate: 1 })] }} />);

    expect(within(card("31")).getByText("1 point")).toBeDefined();
  });

  it("lists open PRs that no ticket links to, marking drafts", () => {
    const tickets = [makeTicket({ pullRequests: [PULL_REQUEST] })];
    const prs = [openPr(9), openPr(4, { isDraft: true }), openPr(5)];

    render(<TicketCards open={{ prs, tickets }} />);

    const unlinked = section("Open PRs without a ticket");
    expect(unlinked.tagName).toBe("SECTION");
    expect(
      within(unlinked)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["PR 4", "PR 5"]);
    expect(within(unlinked).getAllByText("Draft")).toHaveLength(1);
    expect(within(unlinked).getAllByText("acme/api")).toHaveLength(2);
  });

  it("omits the unlinked list when every open PR belongs to a ticket", () => {
    const tickets = [makeTicket({ pullRequests: [PULL_REQUEST] })];

    render(<TicketCards open={{ prs: [openPr(9)], tickets }} />);

    expect(screen.queryByRole("region", { name: "Open PRs without a ticket" })).toBeNull();
  });

  it("says when there are no tickets", () => {
    render(<TicketCards open={{ prs: [], tickets: [] }} />);

    expect(within(section("Your tickets")).getByText("No tickets assigned to you")).toBeDefined();
  });
});
