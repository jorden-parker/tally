import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken, sessionValue } from "./lib/access-token";
import { proxy } from "./proxy";

const API = "http://127.0.0.1:4488/api/sync";
const SAME_ORIGIN_JSON = { origin: "http://127.0.0.1:4488", "content-type": "application/json" };

let directory: string;
let token: string;

function requestFor(headers: Record<string, string>, method = "POST"): NextRequest {
  return new NextRequest(API, {
    method,
    headers: { host: "127.0.0.1:4488", cookie: `tally_session=${sessionValue()}`, ...headers },
  });
}

describe("proxy", () => {
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "tally-proxy-"));
    process.env.TALLY_DATA_DIR = directory;
    token = issueAccessToken();
  });

  afterEach(() => {
    delete process.env.TALLY_DATA_DIR;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("allows same-origin JSON posts and plain reads on loopback hosts", () => {
    expect(proxy(requestFor(SAME_ORIGIN_JSON)).status).toBe(200);
    expect(proxy(requestFor({}, "GET")).status).toBe(200);
    expect(proxy(requestFor({ host: "localhost:4488" }, "GET")).status).toBe(200);
    expect(proxy(requestFor({ host: "[::1]:4488" }, "GET")).status).toBe(200);
  });

  it("refuses other hosts, so DNS rebinding cannot reach it", () => {
    expect(proxy(requestFor({ host: "evil.example:4488" }, "GET")).status).toBe(403);
    expect(proxy(new NextRequest(API, { headers: {} })).status).toBe(403);
  });

  it("refuses writes from other origins or without a JSON body", () => {
    expect(proxy(requestFor({ ...SAME_ORIGIN_JSON, origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect(proxy(requestFor({ ...SAME_ORIGIN_JSON, "content-type": "text/plain" })).status).toBe(
      403,
    );
    expect(proxy(requestFor({})).status).toBe(403);
  });

  it("refuses cross-site fetches even for reads", () => {
    expect(proxy(requestFor({ "sec-fetch-site": "cross-site" }, "GET")).status).toBe(403);
    expect(proxy(requestFor({ "sec-fetch-site": "same-origin" }, "GET")).status).toBe(200);
  });

  it("refuses the master token presented as a cookie", () => {
    expect(proxy(requestFor({ cookie: `tally_session=${token}` }, "GET")).status).toBe(401);
  });

  it("refuses requests without the current session cookie", () => {
    expect(proxy(requestFor({ cookie: "" }, "GET")).status).toBe(401);
    expect(proxy(requestFor({ cookie: "tally_session=wrong" }, "GET")).status).toBe(401);
    expect(proxy(requestFor({ ...SAME_ORIGIN_JSON, cookie: "" })).status).toBe(401);
  });

  it("trades a valid token in the URL for a session cookie and strips it from the URL", () => {
    const request = new NextRequest(`http://127.0.0.1:4488/?range=week&token=${token}`, {
      headers: { host: "127.0.0.1:4488", "sec-fetch-site": "none" },
    });

    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:4488/?range=week");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`tally_session=${sessionValue()}`);
    expect(cookie).not.toContain(token);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=strict/i);
  });

  it("does not trade a wrong token in the URL", () => {
    const request = new NextRequest("http://127.0.0.1:4488/?token=wrong", {
      headers: { host: "127.0.0.1:4488" },
    });

    expect(proxy(request).status).toBe(401);
  });
});
