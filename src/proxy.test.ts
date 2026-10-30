import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const API = "http://127.0.0.1:4488/api/sync";
const SAME_ORIGIN_JSON = { origin: "http://127.0.0.1:4488", "content-type": "application/json" };

function requestFor(headers: Record<string, string>, method = "POST"): NextRequest {
  return new NextRequest(API, { method, headers: { host: "127.0.0.1:4488", ...headers } });
}

describe("proxy", () => {
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
});
