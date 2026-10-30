import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeSummary } from "@/test/fake-api";
import { StatLedger } from "./stat-ledger";

function figure(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  return term.parentElement as HTMLElement;
}

describe("StatLedger", () => {
  it("leads with the reviewed count as tally marks and a comparison", () => {
    render(<StatLedger summary={makeSummary()} />);

    expect(screen.getByRole("img", { name: "7 PRs reviewed" })).toBeDefined();
    expect(screen.getByText("3 more than this point last week")).toBeDefined();
  });

  it("shows each period figure with its comparison", () => {
    render(<StatLedger summary={makeSummary({ range: "day" })} />);

    expect(within(figure("PRs created")).getByText("3")).toBeDefined();
    expect(within(figure("PRs created")).getByText("same as yesterday")).toBeDefined();
    expect(within(figure("PRs merged")).getByText("2 more than yesterday")).toBeDefined();
    expect(within(figure("Tickets completed")).getByText("1 fewer than yesterday")).toBeDefined();
  });

  it("shows where things stand right now", () => {
    render(<StatLedger summary={makeSummary()} />);

    expect(within(figure("Your open PRs")).getByText("2")).toBeDefined();
    expect(within(figure("Waiting on your review")).getByText("1")).toBeDefined();
    expect(within(figure("Tickets in progress")).getByText("3")).toBeDefined();
  });

  it("shows a dash where a snapshot has not been taken yet", () => {
    render(<StatLedger summary={makeSummary({ now: {} })} />);

    expect(within(figure("Tickets in progress")).getByText("–")).toBeDefined();
  });
});
