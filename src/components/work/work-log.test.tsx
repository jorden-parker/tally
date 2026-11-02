import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, FIXED_NOW, makeWorkReport, makeWorkRow } from "@/test/fake-api";
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

  it("leads with what was done in the period", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    expect(
      await screen.findByText("1 PR merged and 1 ticket completed, 1 Oct to 30 Oct"),
    ).toBeDefined();
  });

  it("shows totals in two blocks with their type breakdown", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const totals = await screen.findByRole("region", { name: "Totals" });
    const pullRequests = within(totals).getByRole("group", { name: "Pull requests" });
    expect(within(pullRequests).getByText("+120 −30")).toBeDefined();
    const tickets = within(totals).getByRole("group", { name: "Tickets" });
    expect(within(tickets).getByText("3")).toBeDefined();
    expect(within(tickets).getByText("1 feature")).toBeDefined();
    expect(within(totals).getAllByText("2 days")).toHaveLength(2);
  });

  it("groups each merged PR and completed ticket under its day with detail chips", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const prs = await screen.findByRole("region", { name: "PRs merged" });
    expect(within(prs).getByRole("heading", { name: "PRs merged (1)" })).toBeDefined();
    expect(within(prs).getByRole("heading", { name: "Thu 29 Oct" })).toBeDefined();
    expect(within(prs).getByRole("link", { name: "Ship it" }).getAttribute("href")).toContain(
      "example.test",
    );
    for (const chip of ["acme/api", "+120 −30", "4 files", "merged in 2 days"]) {
      expect(within(prs).getByText(chip)).toBeDefined();
    }
    const tickets = screen.getByRole("region", { name: "Tickets completed" });
    expect(within(tickets).getByRole("heading", { name: "Tickets completed (1)" })).toBeDefined();
    expect(within(tickets).getByText("sc-Ship tally")).toBeDefined();
    expect(within(tickets).getByText("finished in 2 days")).toBeDefined();
  });

  it("shows the PR number when the url has one", async () => {
    const report = makeWorkReport();
    const fetchWork = async () => ({
      ...report,
      prs: [{ ...makeWorkRow("pr_merged", "Ship it"), url: "https://github.com/acme/api/pull/12" }],
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const prs = await screen.findByRole("region", { name: "PRs merged" });
    expect(within(prs).getByText("#12")).toBeDefined();
  });

  it("lists drafts in progress with when they were opened and their review status", async () => {
    const report = makeWorkReport();
    const [draft] = report.drafts;
    const fetchWork = async () => ({
      ...report,
      drafts: draft === undefined ? [] : [{ ...draft, reviewStatus: "awaiting_review" as const }],
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const drafts = await screen.findByRole("region", { name: "Drafts in progress" });
    expect(within(drafts).getByRole("heading", { name: "Drafts in progress (1)" })).toBeDefined();
    expect(within(drafts).getByRole("link", { name: "Tidy the proxy" })).toBeDefined();
    expect(
      within(drafts).getByText("Opened Tue 20 Oct · acme/api · Awaiting review"),
    ).toBeDefined();
  });

  it("leaves the review status off a draft when it is unknown", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const drafts = await screen.findByRole("region", { name: "Drafts in progress" });
    expect(within(drafts).getByText("Opened Tue 20 Oct · acme/api")).toBeDefined();
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

  it("says what the totals leave out beneath each block", async () => {
    const report = makeWorkReport();
    const fetchWork = async () => ({
      ...report,
      totals: { ...report.totals, prsWithoutSize: 2, unestimatedTickets: 1 },
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const totals = await screen.findByRole("region", { name: "Totals" });
    const pullRequests = within(totals).getByRole("group", { name: "Pull requests" });
    expect(within(pullRequests).getByText("2 PRs have no size data")).toBeDefined();
    const tickets = within(totals).getByRole("group", { name: "Tickets" });
    expect(within(tickets).getByText("1 ticket has no estimate")).toBeDefined();
  });

  it("says when a section is empty", async () => {
    const fetchWork = async () => ({ ...makeWorkReport(), prs: [], tickets: [], drafts: [] });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const prs = await screen.findByRole("region", { name: "PRs merged" });
    expect(within(prs).getByText("Nothing in this period")).toBeDefined();
    expect(screen.getByText("No drafts in progress")).toBeDefined();
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
    expect(decodeURIComponent(download.getAttribute("href") ?? "")).toContain("## PRs merged (1)");
  });

  it("links back to the dashboard", () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/");
  });
});
