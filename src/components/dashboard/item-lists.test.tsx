import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OpenItem } from "@/lib/store/open-items";
import { makeEvent, makeSummary } from "@/test/fake-api";
import { ItemLists, OpenLists } from "./item-lists";

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("ItemLists", () => {
  it("links each item out and names its repo", () => {
    render(<ItemLists lists={makeSummary().lists} />);

    const link = within(section("PRs reviewed")).getByRole("link", { name: "Add retries" });
    expect(link.getAttribute("href")).toBe("https://example.test/Add%20retries");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(within(section("PRs reviewed")).getByText("acme/api")).toBeDefined();
  });

  it("invites activity into an empty list", () => {
    render(<ItemLists lists={makeSummary().lists} />);

    expect(within(section("PRs merged")).getByText("Nothing in this period yet")).toBeDefined();
  });

  it("shows tickets without a repo", () => {
    render(<ItemLists lists={makeSummary().lists} />);

    expect(
      within(section("Tickets completed")).getByRole("link", { name: "Ship the tracker" }),
    ).toBeDefined();
  });

  it("caps a long list and counts the rest", () => {
    const many = Array.from({ length: 11 }, (_, index) => makeEvent("pr_created", `PR ${index}`));

    render(<ItemLists lists={{ ...makeSummary().lists, created: many }} />);

    expect(within(section("PRs created")).getAllByRole("link")).toHaveLength(8);
    expect(within(section("PRs created")).getByText("and 3 more")).toBeDefined();
  });
});

function openPr(number: number): OpenItem {
  return {
    source: "github",
    externalId: `https://github.com/acme/api/pull/${number}`,
    openedAt: "2026-10-20T10:00:00Z",
    isDraft: false,
    repo: "acme/api",
    title: `PR ${number}`,
    url: `https://github.com/acme/api/pull/${number}`,
  };
}

describe("OpenLists", () => {
  it("links each open PR and shows its repo", () => {
    render(<OpenLists open={makeSummary().open} />);

    const link = within(section("Your open PRs")).getByRole("link", { name: "Tidy the proxy" });
    expect(link.getAttribute("href")).toBe("https://example.test/Tidy%20the%20proxy");
    expect(within(section("Your open PRs")).getByText("acme/api")).toBeDefined();
  });

  it("marks draft PRs and leaves ready ones unmarked", () => {
    render(<OpenLists open={{ prs: [{ ...openPr(1), isDraft: true }, openPr(2)], tickets: [] }} />);

    expect(within(section("Your open PRs")).getAllByText("Draft")).toHaveLength(1);
  });

  it("shows every item of a long list, with no overflow note", () => {
    const prs = Array.from({ length: 11 }, (_, index) => openPr(index + 1));

    render(<OpenLists open={{ prs, tickets: [] }} />);

    expect(within(section("Your open PRs")).getAllByRole("link")).toHaveLength(11);
    expect(within(section("Your open PRs")).queryByText(/and \d+ more/)).toBeNull();
  });

  it("says when there are no open PRs or assigned tickets", () => {
    render(<OpenLists open={{ prs: [], tickets: [] }} />);

    expect(within(section("Your open PRs")).getByText("No open PRs")).toBeDefined();
    expect(
      within(section("Tickets assigned to you")).getByText("No tickets assigned to you"),
    ).toBeDefined();
  });
});
