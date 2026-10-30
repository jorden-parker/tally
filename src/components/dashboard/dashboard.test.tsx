import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FIXED_NOW, fakeApi, makeSettings, makeSummary } from "@/test/fake-api";
import { Dashboard } from "./dashboard";

const now = () => FIXED_NOW;

describe("Dashboard", () => {
  it("shows this week's figures and lists once loaded", async () => {
    render(<Dashboard api={fakeApi()} now={now} />);

    expect(await screen.findByRole("img", { name: "7 PRs reviewed" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Add retries" })).toBeDefined();
    expect(screen.getByRole("button", { name: "This week" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("Synced 5 minutes ago")).toBeDefined();
  });

  it("loads the chosen range", async () => {
    const fetchSummary = vi.fn(async (range) => makeSummary({ range }));
    render(<Dashboard api={fakeApi({ fetchSummary })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    await waitFor(() => expect(fetchSummary).toHaveBeenLastCalledWith("day"));
    expect(screen.getByRole("button", { name: "Today" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("syncs on load when the data is stale, then reloads", async () => {
    const stale = makeSummary({ lastSyncedAt: "2026-10-30T09:00:00Z" });
    const fetchSummary = vi.fn(async () => stale);
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: [] }));
    render(<Dashboard api={fakeApi({ fetchSummary, runSync })} now={now} />);

    await waitFor(() => expect(runSync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchSummary).toHaveBeenCalledTimes(2));
  });

  it("does not sync on load when the data is fresh", async () => {
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: [] }));
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    expect(runSync).not.toHaveBeenCalled();
  });

  it("syncs on demand and reports which source failed", async () => {
    const runSync = vi.fn(async () => ({
      errors: { github: "gh exploded" },
      uncountedReviewRepos: [],
    }));
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect((await screen.findByRole("alert")).textContent).toContain("GitHub: gh exploded");
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("names repos whose reviews are not counted", async () => {
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: ["stranger/lib"] }));
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect((await screen.findByRole("alert")).textContent).toContain("stranger/lib");
  });

  it("asks for an allow-list before there is anything to count", async () => {
    const fetchSettings = async () => makeSettings({ allowList: [] });
    render(
      <Dashboard
        api={fakeApi({
          fetchSettings,
          fetchSummary: async () => makeSummary({ lastSyncedAt: null }),
        })}
        now={now}
      />,
    );

    const link = await screen.findByRole("link", { name: "Choose them in settings" });
    expect(link.getAttribute("href")).toBe("/settings");
  });

  it("shows why loading failed", async () => {
    const fetchSummary = async () => {
      throw new Error("database is locked");
    };
    render(<Dashboard api={fakeApi({ fetchSummary })} now={now} />);

    expect((await screen.findByRole("alert")).textContent).toContain("database is locked");
  });
});
