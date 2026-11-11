import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { readAccessToken } from "../../src/lib/access-token";
import {
  parseCheckOptions,
  runBrowserCheck,
  type BrowserSession,
  type CheckOptions,
  type PageObservation,
  type RunningServer,
} from "./browser-check";

const SERVER_READY_LINE = "Open Tally at";
const SERVER_START_TIMEOUT_MILLISECONDS = 120_000;
const PAGE_SETTLE_TIMEOUT_MILLISECONDS = 30_000;
const POLL_INTERVAL_MILLISECONDS = 250;
const ERROR_OVERLAY_SELECTOR = "nextjs-portal [data-nextjs-dialog]";
const VIEWPORT = { width: 1280, height: 900 };

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isServerResponding(baseUrl: string): Promise<boolean> {
  try {
    await fetch(baseUrl, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

function stopProcessGroup(server: ChildProcess): void {
  if (server.pid === undefined || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function waitUntilServing(
  server: ChildProcess,
  isReadyToServe: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("The dev server exited before it was ready");
    if (await isReadyToServe()) return;
    await pause(POLL_INTERVAL_MILLISECONDS);
  }
  throw new Error("Timed out waiting for the dev server to start");
}

async function startDevServer(baseUrl: string): Promise<RunningServer> {
  const server = spawn("bun", ["run", "dev"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  const collectOutput = (chunk: Buffer) => {
    serverOutput += chunk.toString();
  };
  server.stdout?.on("data", collectOutput);
  server.stderr?.on("data", collectOutput);
  try {
    await waitUntilServing(
      server,
      async () => serverOutput.includes(SERVER_READY_LINE) && (await isServerResponding(baseUrl)),
    );
  } catch (e) {
    stopProcessGroup(server);
    throw new Error(`${(e as Error).message}\n${serverOutput}`);
  }
  return {
    async stop() {
      stopProcessGroup(server);
    },
  };
}

async function reuseOrStartServer(baseUrl: string): Promise<RunningServer> {
  if (await isServerResponding(baseUrl)) return { async stop() {} };
  return startDevServer(baseUrl);
}

async function readErrorOverlay(page: Page): Promise<string | null> {
  const overlay = page.locator(ERROR_OVERLAY_SELECTOR).first();
  if ((await overlay.count()) === 0) return null;
  return (await overlay.innerText()).replace(/\s+/g, " ").trim();
}

async function findScrollContainers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scrollingOverflows = ["auto", "scroll"];
    const describeElement = (element: Element): string => {
      const label = element.getAttribute("aria-label");
      const firstClass = element.classList[0];
      if (label) return `${element.localName}[aria-label=${label}]`;
      if (element.id) return `${element.localName}#${element.id}`;
      return firstClass ? `${element.localName}.${firstClass}` : element.localName;
    };
    const findOverflow = (element: Element) => {
      const style = getComputedStyle(element);
      const axes = [
        {
          direction: "horizontally",
          overflow: style.overflowX,
          excess: element.scrollWidth - element.clientWidth,
        },
        {
          direction: "vertically",
          overflow: style.overflowY,
          excess: element.scrollHeight - element.clientHeight,
        },
      ];
      return axes
        .filter(({ overflow, excess }) => scrollingOverflows.includes(overflow) && excess > 0)
        .map(({ direction, excess }) => `scrolls ${direction} by ${excess}px`);
    };
    return [...document.body.querySelectorAll("*")].flatMap((element) =>
      findOverflow(element).map((overflow) => `${describeElement(element)} ${overflow}`),
    );
  });
}

async function observePage(
  context: BrowserContext,
  url: string,
  screenshotPath: string,
): Promise<PageObservation> {
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const uncaughtErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => uncaughtErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`),
  );
  page.on("response", (response) => {
    if (response.status() < 400 || response.url() === url) return;
    failedRequests.push(`${response.request().method()} ${response.url()} ${response.status()}`);
  });
  try {
    const response = await page.goto(url, { waitUntil: "load" }).catch(() => null);
    await page
      .waitForLoadState("networkidle", { timeout: PAGE_SETTLE_TIMEOUT_MILLISECONDS })
      .catch(() => undefined);
    const observation: PageObservation = {
      status: response?.status() ?? null,
      title: await page.title(),
      visibleText: await page.innerText("body"),
      consoleErrors,
      uncaughtErrors,
      failedRequests,
      errorOverlay: await readErrorOverlay(page),
      scrollContainers: await findScrollContainers(page),
    };
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return observation;
  } finally {
    await page.close();
  }
}

async function openChromeSession(): Promise<BrowserSession> {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  return {
    async signIn(loginUrl) {
      const page = await context.newPage();
      await page.goto(loginUrl);
      await page.close();
    },
    visit: (url, screenshotPath) => observePage(context, url, screenshotPath),
    close: () => browser.close(),
  };
}

function prepareScreenshotDirectory(options: CheckOptions): void {
  fs.mkdirSync(options.screenshotDirectory, { recursive: true, mode: 0o700 });
}

const options = parseCheckOptions(
  process.argv.slice(2),
  path.join(os.tmpdir(), "tally-browser-check"),
);
prepareScreenshotDirectory(options);
const isHealthy = await runBrowserCheck(options, {
  startServer: () => reuseOrStartServer(options.baseUrl),
  readAccessToken,
  openBrowser: openChromeSession,
  report: (line) => console.log(line),
});
process.exit(isHealthy ? 0 : 1);
