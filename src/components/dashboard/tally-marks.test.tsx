import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TallyMarks } from "./tally-marks";

describe("TallyMarks", () => {
  it("draws one stroke per counted item, with a strike across each full group", () => {
    render(<TallyMarks count={7} label="7 PRs reviewed" />);

    const image = screen.getByRole("img", { name: "7 PRs reviewed" });
    expect(image.querySelectorAll("line")).toHaveLength(7);
  });

  it("draws nothing for zero but stays labelled", () => {
    render(<TallyMarks count={0} label="0 PRs reviewed" />);

    expect(
      screen.getByRole("img", { name: "0 PRs reviewed" }).querySelectorAll("line"),
    ).toHaveLength(0);
  });

  it("wobbles each stroke by the same amount on every render", () => {
    const positions = () => {
      const { unmount } = render(<TallyMarks count={9} label="9 PRs reviewed" />);
      const lines = [
        ...screen.getByRole("img", { name: "9 PRs reviewed" }).querySelectorAll("line"),
      ];
      const coordinates = lines.map((line) =>
        ["x1", "y1", "x2", "y2"].map((name) => line.getAttribute(name)).join(","),
      );
      unmount();
      return coordinates;
    };

    const first = positions();
    expect(positions()).toEqual(first);
    const leaning = first.filter((coordinate) => {
      const [x1, , x2] = coordinate.split(",");
      return x1 !== x2;
    });
    expect(leaning.length).toBeGreaterThan(2);
  });

  it("staggers the draw-on of each stroke", () => {
    render(<TallyMarks count={3} label="3 PRs reviewed" />);

    const delays = [
      ...screen.getByRole("img", { name: "3 PRs reviewed" }).querySelectorAll("line"),
    ].map((line) => line.style.animationDelay);
    expect(new Set(delays).size).toBe(3);
  });

  it("says how many marks it left out past the cap", () => {
    render(<TallyMarks count={53} label="53 PRs reviewed" />);

    expect(screen.getByText("+3")).toBeDefined();
  });
});
