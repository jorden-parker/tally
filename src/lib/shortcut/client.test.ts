import { describe, expect, it } from "vitest";
import { createShortcutGet } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("createShortcutGet", () => {
  it("calls the API with the token header and parses the JSON body", async () => {
    const requests: { url: string; token: string | null }[] = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      requests.push({
        url: String(input),
        token: new Headers(init?.headers).get("Shortcut-Token"),
      });
      return jsonResponse({ mention_name: "jorden" });
    };

    const get = createShortcutGet("secret", fakeFetch);

    expect(await get("/api/v3/member")).toEqual({ mention_name: "jorden" });
    expect(requests).toEqual([
      { url: "https://api.app.shortcut.com/api/v3/member", token: "secret" },
    ]);
  });

  it("throws with the status when the API rejects the request", async () => {
    const get = createShortcutGet("bad", async () => jsonResponse({ message: "nope" }, 401));

    await expect(get("/api/v3/member")).rejects.toThrow(/401/);
  });
});
