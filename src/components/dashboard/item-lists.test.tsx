import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeEvent, makeSummary } from "@/test/fake-api";
import { ItemLists } from "./item-lists";

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
