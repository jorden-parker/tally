import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/dashboard", () => ({
  Dashboard: () => <p>dashboard</p>,
}));
vi.mock("@/components/settings/settings-form", () => ({
  SettingsForm: () => <p>settings form</p>,
}));

import DashboardPage from "./page";
import SettingsPage from "./settings/page";

describe("pages", () => {
  it("render the dashboard at the root", () => {
    render(<DashboardPage />);

    expect(screen.getByText("dashboard")).toBeDefined();
  });

  it("render the settings form with a way back", () => {
    render(<SettingsPage />);

    expect(screen.getByText("settings form")).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href")).toBe("/");
  });
});
