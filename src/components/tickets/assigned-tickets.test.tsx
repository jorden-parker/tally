import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeApi, makeAssignedStory } from "@/test/fake-api";
import { AssignedTickets } from "./assigned-tickets";

const STORIES = [
  makeAssignedStory({ id: "31", title: "Plan the rollout" }),
  makeAssignedStory({
    id: "32",
    title: "Write the runbook",
    state: "Ready for Review",
    statePosition: 4,
  }),
  makeAssignedStory({
    id: "21",
    title: "Ship tally",
    state: "Done",
    stateType: "done",
    statePosition: 5,
    completedAt: "2026-10-29T09:00:00Z",
  }),
];

function renderTickets() {
  return render(<AssignedTickets api={fakeApi({ fetchAssignedStories: async () => STORIES })} />);
}

function readHeadings(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
}

describe("AssignedTickets", () => {
  it("groups every assigned ticket by workflow state by default", async () => {
    renderTickets();

    const inProgress = await screen.findByRole("region", { name: "In Progress" });
    expect(within(inProgress).getByRole("link", { name: "Plan the rollout" })).toBeDefined();
    expect(readHeadings()).toEqual(["In Progress (1)", "Ready for Review (1)", "Done (1)"]);
    expect(screen.getByText(/Completed Thu 29 Oct/)).toBeDefined();
  });

  it("groups by state type or not at all", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    fireEvent.change(screen.getByLabelText("Group by"), { target: { value: "type" } });
    expect(readHeadings()).toEqual(["Started (2)", "Done (1)"]);

    fireEvent.change(screen.getByLabelText("Group by"), { target: { value: "none" } });
    expect(readHeadings()).toEqual(["All tickets (3)"]);
  });

  it("filters by state type or by one workflow state", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "type:started" } });
    expect(readHeadings()).toEqual(["In Progress (1)", "Ready for Review (1)"]);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "state:Done" } });
    expect(readHeadings()).toEqual(["Done (1)"]);
    expect(screen.queryByRole("link", { name: "Plan the rollout" })).toBeNull();
  });

  it("offers each state present, under its state type", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    const started = within(screen.getByLabelText("Status")).getByRole("group", { name: "Started" });
    expect(
      within(started)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Any started", "In Progress", "Ready for Review"]);
  });

  it("says so when nothing matches or nothing is assigned", async () => {
    render(<AssignedTickets api={fakeApi({ fetchAssignedStories: async () => [] })} />);

    expect(await screen.findByText(/No tickets here/)).toBeDefined();
  });

  it("shows a load failure", async () => {
    render(
      <AssignedTickets
        api={fakeApi({
          fetchAssignedStories: async () => {
            throw new Error("boom");
          },
        })}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain("boom");
  });

  it("renders Markdown in story titles", async () => {
    render(
      <AssignedTickets
        api={fakeApi({
          fetchAssignedStories: async () => [makeAssignedStory({ title: "Fix `parse` crash" })],
        })}
      />,
    );

    expect((await screen.findByText("parse")).tagName).toBe("CODE");
  });
});
