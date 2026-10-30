import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, FIXED_NOW, makeWorkReport } from "@/test/fake-api";
import { WorkLog } from "./work-log";

const now = () => FIXED_NOW;

function setDate(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("WorkLog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the last 30 days by default", async () => {
    const fetchWork = vi.fn(async () => makeWorkReport({ from: "2026-10-01", to: "2026-10-30" }));

    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    await screen.findByRole("region", { name: "PRs merged" });
    expect(fetchWork).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-30" });
  });

  it("shows totals, and each merged PR, completed ticket and draft with its evidence", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const prs = await screen.findByRole("region", { name: "PRs merged" });
    expect(within(prs).getByRole("link", { name: "Ship it" }).getAttribute("href")).toContain(
      "example.test",
    );
    expect(within(prs).getByText(/\+120 −30, 4 files · merged in 2 days/)).toBeDefined();
    expect(within(prs).getByText(/2026-10-29/)).toBeDefined();
    const tickets = screen.getByRole("region", { name: "Tickets completed" });
    expect(within(tickets).getByText(/feature · 3 points · finished in 2 days/)).toBeDefined();
    const drafts = screen.getByRole("region", { name: "Draft PRs (current)" });
    expect(within(drafts).getByRole("link", { name: "Tidy the proxy" })).toBeDefined();
    const totals = screen.getByRole("region", { name: "Totals" });
    expect(within(totals).getByText("+120 −30")).toBeDefined();
    expect(within(totals).getAllByText("2 days")).toHaveLength(2);
  });

  it("reloads when the dates change", async () => {
    const fetchWork = vi.fn(async (period) => makeWorkReport(period));
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "PRs merged" });

    setDate("From", "2026-07-01");

    await waitFor(() =>
      expect(fetchWork).toHaveBeenLastCalledWith({ from: "2026-07-01", to: "2026-10-30" }),
    );
  });

  it("asks for both dates instead of fetching when one is cleared", async () => {
    const fetchWork = vi.fn(async (period) => makeWorkReport(period));
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "PRs merged" });

    setDate("To", "");

    expect((await screen.findByRole("alert")).textContent).toContain("Choose both dates");
    expect(screen.queryByRole("region", { name: "PRs merged" })).toBeNull();
    expect(fetchWork).toHaveBeenCalledTimes(1);
  });

  it("shows why a period failed and hides the previous report", async () => {
    const fetchWork = vi.fn(async (period: { from: string; to: string }) => {
      if (period.from === "2026-11-01")
        throw new Error("Choose a from date on or before the to date.");
      return makeWorkReport(period);
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "PRs merged" });

    setDate("From", "2026-11-01");

    expect((await screen.findByRole("alert")).textContent).toContain("on or before");
    expect(screen.queryByRole("region", { name: "PRs merged" })).toBeNull();
  });

  it("clears the problem once a period loads", async () => {
    const fetchWork = vi.fn(async (period: { from: string; to: string }) => {
      if (period.from === "2026-11-01") throw new Error("Bad period");
      return makeWorkReport(period);
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "PRs merged" });
    setDate("From", "2026-11-01");
    await screen.findByRole("alert");

    setDate("From", "2026-10-02");

    await screen.findByRole("region", { name: "PRs merged" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says what the totals leave out", async () => {
    const report = makeWorkReport();
    const fetchWork = async () => ({
      ...report,
      totals: { ...report.totals, prsWithoutSize: 2, unestimatedTickets: 1 },
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    expect(await screen.findByText(/2 PRs have no size data/)).toBeDefined();
    expect(screen.getByText(/1 ticket has no estimate/)).toBeDefined();
  });

  it("says when a section is empty", async () => {
    const fetchWork = async () => ({ ...makeWorkReport(), prs: [], tickets: [], drafts: [] });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const prs = await screen.findByRole("region", { name: "PRs merged" });
    expect(within(prs).getByText("Nothing in this period")).toBeDefined();
    expect(screen.getByText("No draft PRs")).toBeDefined();
  });

  it("copies the report as Markdown", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<WorkLog api={fakeApi()} now={now} />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy Markdown" }));

    await screen.findByRole("button", { name: "Copied" });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Work log: 2026-10-01"));
  });

  it("says when copying fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    render(<WorkLog api={fakeApi()} now={now} />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy Markdown" }));

    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeDefined();
  });

  it("offers the report as a Markdown download named after the period", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const download = await screen.findByRole("link", { name: "Download .md" });

    expect(download.getAttribute("download")).toBe("work-log-2026-10-01-to-2026-10-30.md");
    expect(decodeURIComponent(download.getAttribute("href") ?? "")).toContain("## PRs merged");
  });

  it("links back to the dashboard", () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/");
  });
});
