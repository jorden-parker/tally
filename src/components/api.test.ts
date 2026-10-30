import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

const fetchMock = vi.fn();

function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("fetches the work report for a period", async () => {
    respond({ from: "2026-10-01" });

    await api.fetchWork({ from: "2026-10-01", to: "2026-10-30" });

    expect(fetchMock).toHaveBeenCalledWith("/api/work?from=2026-10-01&to=2026-10-30", undefined);
  });

  it("fetches the summary for a range", async () => {
    respond({ range: "day" });

    expect(await api.fetchSummary("day")).toEqual({ range: "day" });
    expect(fetchMock).toHaveBeenCalledWith("/api/metrics?range=day", undefined);
  });

  it("fetches the settings", async () => {
    respond({ allowList: [] });

    expect(await api.fetchSettings()).toEqual({ allowList: [] });
    expect(fetchMock).toHaveBeenCalledWith("/api/settings", undefined);
  });

  it("posts a sync as JSON", async () => {
    respond({ errors: {} });

    expect(await api.runSync()).toEqual({ errors: {} });
    expect(fetchMock).toHaveBeenCalledWith("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  });

  it("puts settings changes as JSON", async () => {
    respond({ allowList: ["acme"] });

    await api.saveSettings({ allowList: ["acme"] });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allowList: ["acme"] }),
    });
  });

  it("throws the server's error message", async () => {
    respond({ error: "allowList: Invalid" }, 400);

    await expect(api.saveSettings({})).rejects.toThrow("allowList: Invalid");
  });

  it("throws the status when the body has no message", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));

    await expect(api.fetchSettings()).rejects.toThrow("Request failed with status 500");
  });
});
