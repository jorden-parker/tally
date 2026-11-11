import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell, ProblemAlert, SectionHeading } from "./page-shell";

describe("PageShell", () => {
  it("titles the page and shows its actions", () => {
    render(
      <PageShell
        title="Work log"
        description="Every PR"
        actions={<button type="button">Go</button>}
      >
        <p>body</p>
      </PageShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Work log" })).toBeDefined();
    expect(screen.getByText("Every PR")).toBeDefined();
    expect(screen.getByRole("button", { name: "Go" })).toBeDefined();
    expect(screen.getByText("body")).toBeDefined();
  });
});

describe("SectionHeading", () => {
  it("reads the count in brackets", () => {
    render(<SectionHeading title="Done" count={3} />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Done (3)");
  });

  it("can be a third-level heading without a count", () => {
    render(<SectionHeading title="Tickets" level={3} />);

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Tickets");
  });
});

describe("ProblemAlert", () => {
  it("renders nothing without messages", () => {
    render(<ProblemAlert messages={[]} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists each message", () => {
    render(<ProblemAlert messages={["GitHub failed", "Shortcut failed"]} />);

    expect(screen.getByRole("alert").textContent).toBe("GitHub failedShortcut failed");
  });
});
