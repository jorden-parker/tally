import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("links to every page", () => {
    render(<SiteHeader />);

    const hrefs = Object.fromEntries(
      ["Dashboard", "Tickets", "Work log", "Settings"].map((name) => [
        name,
        screen.getByRole("link", { name }).getAttribute("href"),
      ]),
    );
    expect(hrefs).toEqual({
      Dashboard: "/",
      Tickets: "/tickets",
      "Work log": "/work",
      Settings: "/settings",
    });
  });

  it("marks the current page", () => {
    pathname.current = "/work";
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Work log" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });

  it("names the app with a link home", () => {
    pathname.current = "/settings";
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Tally home" }).getAttribute("href")).toBe("/");
  });
});
