import { describe, expect, it } from "vitest";
import {
  findPageProblems,
  parseCheckOptions,
  runBrowserCheck,
  nameScreenshotFile,
  type BrowserSession,
  type CheckDependencies,
  type PageObservation,
} from "./browser-check";

const healthyObservation: PageObservation = {
  status: 200,
  title: "Tally",
  visibleText: "Dashboard",
  consoleErrors: [],
  uncaughtErrors: [],
  failedRequests: [],
  errorOverlay: null,
  scrollContainers: [],
};

interface FakeCheck {
  dependencies: CheckDependencies;
  calls: string[];
  reportedLines: string[];
}

function createFakeCheck(
  overrides: {
    token?: string | null;
    observations?: Record<string, PageObservation>;
    visitFailure?: Error;
  } = {},
): FakeCheck {
  const calls: string[] = [];
  const reportedLines: string[] = [];
  const token = overrides.token === undefined ? "secret-token" : overrides.token;
  const session: BrowserSession = {
    async signIn(loginUrl) {
      calls.push(`signIn ${loginUrl}`);
    },
    async visit(url, screenshotPath) {
      calls.push(`visit ${url} -> ${screenshotPath}`);
      if (overrides.visitFailure) throw overrides.visitFailure;
      return overrides.observations?.[url] ?? healthyObservation;
    },
    async close() {
      calls.push("closeBrowser");
    },
  };
  const dependencies: CheckDependencies = {
    async startServer() {
      calls.push("startServer");
      return {
        async stop() {
          calls.push("stopServer");
        },
      };
    },
    readAccessToken: () => token,
    async openBrowser() {
      calls.push("openBrowser");
      return session;
    },
    report: (line) => reportedLines.push(line),
  };
  return { dependencies, calls, reportedLines };
}

const checkOptions = {
  baseUrl: "http://127.0.0.1:4488",
  paths: ["/", "/work"],
  screenshotDirectory: "/shots",
};

describe("findPageProblems", () => {
  it("finds nothing wrong with a page that rendered cleanly", () => {
    expect(findPageProblems(healthyObservation)).toEqual([]);
  });

  it("reports a page the request gate refused", () => {
    expect(
      findPageProblems({ ...healthyObservation, status: 403, visibleText: "Forbidden" }),
    ).toEqual(["responded with HTTP 403"]);
  });

  it("reports a page that never responded", () => {
    expect(findPageProblems({ ...healthyObservation, status: null })).toEqual(["did not respond"]);
  });

  it("reports a blank page", () => {
    expect(findPageProblems({ ...healthyObservation, visibleText: " \n" })).toEqual([
      "rendered no visible text",
    ]);
  });

  it("reports browser errors, failed requests and the Next.js error overlay", () => {
    expect(
      findPageProblems({
        ...healthyObservation,
        consoleErrors: ["Hydration failed"],
        uncaughtErrors: ["boom"],
        failedRequests: ["GET http://127.0.0.1:4488/api/metrics 500"],
        errorOverlay: "Module not found: Can't resolve 'tw-animate-css'",
      }),
    ).toEqual([
      "console error: Hydration failed",
      "uncaught error: boom",
      "failed request: GET http://127.0.0.1:4488/api/metrics 500",
      "Next.js error overlay: Module not found: Can't resolve 'tw-animate-css'",
    ]);
  });
});

describe("scroll containers", () => {
  const scrollingObservation = {
    ...healthyObservation,
    scrollContainers: ["nav[aria-label=Pages] scrolls vertically by 2px"],
  };

  it("reports an element that scrolls unexpectedly", () => {
    expect(findPageProblems(scrollingObservation)).toEqual([
      "unexpected scrollbar: nav[aria-label=Pages] scrolls vertically by 2px",
    ]);
  });

  it("fails the run when a page has an unexpected scrollbar", async () => {
    const { dependencies } = createFakeCheck({
      observations: { "http://127.0.0.1:4488/": scrollingObservation },
    });

    expect(await runBrowserCheck(checkOptions, dependencies)).toBe(false);
  });
});

describe("nameScreenshotFile", () => {
  it("names the dashboard screenshot home", () => {
    expect(nameScreenshotFile("/")).toBe("home.png");
  });

  it("names a screenshot after its path and query", () => {
    expect(nameScreenshotFile("/work?from=2026-11-01&to=2026-11-11")).toBe(
      "work-from-2026-11-01-to-2026-11-11.png",
    );
  });
});

describe("parseCheckOptions", () => {
  it("checks every page by default", () => {
    expect(parseCheckOptions([], "/default-shots")).toEqual({
      baseUrl: "http://127.0.0.1:4488",
      paths: ["/", "/work", "/tickets", "/settings"],
      screenshotDirectory: "/default-shots",
    });
  });

  it("checks only the paths it is given", () => {
    expect(parseCheckOptions(["/tickets", "/settings"], "/default-shots").paths).toEqual([
      "/tickets",
      "/settings",
    ]);
  });

  it("saves screenshots where it is told", () => {
    expect(parseCheckOptions(["--screenshots", "/elsewhere", "/work"], "/default-shots")).toEqual({
      baseUrl: "http://127.0.0.1:4488",
      paths: ["/work"],
      screenshotDirectory: "/elsewhere",
    });
  });

  it("rejects a path that is not rooted in the app", () => {
    expect(() => parseCheckOptions(["https://example.com"], "/default-shots")).toThrow(
      'Expected a path starting with "/", got "https://example.com"',
    );
  });
});

describe("runBrowserCheck", () => {
  it("signs in with the access token, then visits each path", async () => {
    const { dependencies, calls } = createFakeCheck();

    const isHealthy = await runBrowserCheck(checkOptions, dependencies);

    expect(isHealthy).toBe(true);
    expect(calls).toEqual([
      "startServer",
      "openBrowser",
      "signIn http://127.0.0.1:4488/?token=secret-token",
      "visit http://127.0.0.1:4488/ -> /shots/home.png",
      "visit http://127.0.0.1:4488/work -> /shots/work.png",
      "closeBrowser",
      "stopServer",
    ]);
  });

  it("reports each page with its status, title and screenshot", async () => {
    const { dependencies, reportedLines } = createFakeCheck();

    await runBrowserCheck(checkOptions, dependencies);

    expect(reportedLines).toEqual([
      'ok   / (HTTP 200, title "Tally") screenshot: /shots/home.png',
      'ok   /work (HTTP 200, title "Tally") screenshot: /shots/work.png',
    ]);
  });

  it("fails and lists the problems when a page is broken", async () => {
    const { dependencies, reportedLines } = createFakeCheck({
      observations: {
        "http://127.0.0.1:4488/work": {
          ...healthyObservation,
          status: 500,
          consoleErrors: ["Failed to load resource"],
        },
      },
    });

    const isHealthy = await runBrowserCheck(checkOptions, dependencies);

    expect(isHealthy).toBe(false);
    expect(reportedLines).toEqual([
      'ok   / (HTTP 200, title "Tally") screenshot: /shots/home.png',
      'FAIL /work (HTTP 500, title "Tally") screenshot: /shots/work.png',
      "     - responded with HTTP 500",
      "     - console error: Failed to load resource",
    ]);
  });

  it("never prints the access token", async () => {
    const { dependencies, reportedLines } = createFakeCheck();

    await runBrowserCheck(checkOptions, dependencies);

    expect(reportedLines.join("\n")).not.toContain("secret-token");
  });

  it("fails without opening a browser when the server issued no token", async () => {
    const { dependencies, calls, reportedLines } = createFakeCheck({ token: null });

    const isHealthy = await runBrowserCheck(checkOptions, dependencies);

    expect(isHealthy).toBe(false);
    expect(calls).toEqual(["startServer", "stopServer"]);
    expect(reportedLines).toEqual(["FAIL no access token found; the server has not issued one"]);
  });

  it("closes the browser and stops the server when a visit throws", async () => {
    const { dependencies, calls } = createFakeCheck({ visitFailure: new Error("crashed") });

    await expect(runBrowserCheck(checkOptions, dependencies)).rejects.toThrow("crashed");

    expect(calls.slice(-2)).toEqual(["closeBrowser", "stopServer"]);
  });
});
