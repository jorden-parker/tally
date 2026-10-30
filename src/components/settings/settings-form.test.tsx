import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, makeSettings } from "@/test/fake-api";
import { SettingsForm } from "./settings-form";

describe("SettingsForm", () => {
  it("shows the saved settings", async () => {
    const fetchSettings = async () =>
      makeSettings({ allowList: ["acme", "me/side"], weekStart: 0 });
    render(<SettingsForm api={fakeApi({ fetchSettings })} />);

    const allowList = (await screen.findByLabelText(
      "GitHub orgs and repos",
    )) as HTMLTextAreaElement;
    expect(allowList.value).toBe("acme\nme/side");
    expect((screen.getByLabelText("Week starts on") as HTMLSelectElement).value).toBe("0");
    expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).toBe("UTC");
  });

  it("saves the edited values and says what to do next", async () => {
    const saveSettings = vi.fn(async () => makeSettings());
    render(<SettingsForm api={fakeApi({ saveSettings })} />);
    const allowList = await screen.findByLabelText("GitHub orgs and repos");

    await userEvent.clear(allowList);
    await userEvent.type(allowList, "acme{Enter}me/side");
    await userEvent.selectOptions(screen.getByLabelText("Week starts on"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(saveSettings).toHaveBeenCalledWith({
      allowList: ["acme", "me/side"],
      weekStart: 0,
      timeZone: "UTC",
    });
    expect(await screen.findByText(/Saved\. Sync from the dashboard/)).toBeDefined();
  });

  it("shows why saving failed", async () => {
    const saveSettings = async () => {
      throw new Error("allowList: Invalid string");
    };
    render(<SettingsForm api={fakeApi({ saveSettings })} />);
    await screen.findByLabelText("GitHub orgs and repos");

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("allowList: Invalid string"),
    );
  });

  it("shows why loading failed", async () => {
    const fetchSettings = async () => {
      throw new Error("database is locked");
    };
    render(<SettingsForm api={fakeApi({ fetchSettings })} />);

    expect((await screen.findByRole("alert")).textContent).toContain("database is locked");
  });
});
