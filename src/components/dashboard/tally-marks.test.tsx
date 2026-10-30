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

  it("says how many marks it left out past the cap", () => {
    render(<TallyMarks count={53} label="53 PRs reviewed" />);

    expect(screen.getByText("+3")).toBeDefined();
  });
});
