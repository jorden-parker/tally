import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeSummary } from "@/test/fake-api";
import { DailyChart } from "./daily-chart";

const POINTS = makeSummary().daily;

describe("DailyChart", () => {
  it("names both series in a legend", () => {
    render(<DailyChart points={POINTS} />);

    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getByText("Reviewed")).toBeDefined();
    expect(within(legend).getByText("Created")).toBeDefined();
  });

  it("offers every day in a table view", () => {
    render(<DailyChart points={POINTS} />);

    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(29);
  });

  it("shows a tooltip for the day under the pointer and hides it on leave", () => {
    render(<DailyChart points={POINTS} />);

    const column = screen.getByTestId("day-2026-10-11");
    fireEvent.mouseEnter(column);
    expect(screen.getByRole("tooltip").textContent).toContain("Oct 11");
    expect(screen.getByRole("tooltip").textContent).toContain("3 reviewed");
    expect(screen.getByRole("tooltip").textContent).toContain("2 created");

    fireEvent.mouseLeave(column);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the same tooltip when a day is focused with the keyboard", () => {
    render(<DailyChart points={POINTS} />);

    fireEvent.focus(screen.getByTestId("day-2026-10-11"));

    expect(screen.getByRole("tooltip").textContent).toContain("Oct 11");
  });

  it("handles a quiet month without dividing by zero", () => {
    const quiet = POINTS.map((point) => ({ ...point, reviewed: 0, created: 0 }));

    render(<DailyChart points={quiet} />);

    expect(screen.getByRole("group", { name: /reviewed and created per day/i })).toBeDefined();
  });
});
