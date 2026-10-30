import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidSettingsError, type Services } from "@/lib/server/services";

const services = vi.hoisted(() => ({
  summary: vi.fn(),
  work: vi.fn(),
  sync: vi.fn(),
  settings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@/lib/server/default-services", () => ({
  getServices: (): Services => services,
}));

import { GET as getMetrics } from "./metrics/route";
import { GET as getSettings, PUT as putSettings } from "./settings/route";
import { POST as postSync } from "./sync/route";
import { GET as getWork } from "./work/route";

function jsonRequest(body: unknown, method = "PUT"): Request {
  return new Request("http://127.0.0.1:4488/api/settings", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("api routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/work", () => {
    it("returns the report for the period", async () => {
      services.work.mockReturnValue({ from: "2026-10-01" });

      const response = await getWork(
        new Request("http://127.0.0.1:4488/api/work?from=2026-10-01&to=2026-10-30"),
      );

      expect(await response.json()).toEqual({ from: "2026-10-01" });
      expect(services.work).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-30" });
    });

    it("rejects a period that is missing, invalid or reversed", async () => {
      const response = await getWork(
        new Request("http://127.0.0.1:4488/api/work?from=2026-10-30&to=2026-10-01"),
      );

      expect(response.status).toBe(400);
      expect(services.work).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/metrics", () => {
    it("returns the summary for the requested range", async () => {
      services.summary.mockReturnValue({ range: "day" });

      const response = await getMetrics(new Request("http://127.0.0.1:4488/api/metrics?range=day"));

      expect(services.summary).toHaveBeenCalledWith("day");
      expect(await response.json()).toEqual({ range: "day" });
    });

    it("defaults to the week", async () => {
      services.summary.mockReturnValue({ range: "week" });

      await getMetrics(new Request("http://127.0.0.1:4488/api/metrics"));

      expect(services.summary).toHaveBeenCalledWith("week");
    });

    it("rejects an unknown range", async () => {
      const response = await getMetrics(
        new Request("http://127.0.0.1:4488/api/metrics?range=year"),
      );

      expect(response.status).toBe(400);
      expect(services.summary).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/sync", () => {
    it("returns the sync result", async () => {
      services.sync.mockResolvedValue({ errors: { github: "boom" } });

      const response = await postSync();

      expect(await response.json()).toEqual({ errors: { github: "boom" } });
    });
  });

  describe("settings", () => {
    it("returns the current settings", async () => {
      services.settings.mockReturnValue({ allowList: ["acme"] });

      const response = await getSettings();

      expect(await response.json()).toEqual({ allowList: ["acme"] });
    });

    it("saves valid changes", async () => {
      services.updateSettings.mockReturnValue({ allowList: ["acme"] });

      const response = await putSettings(jsonRequest({ allowList: ["acme"] }));

      expect(services.updateSettings).toHaveBeenCalledWith({ allowList: ["acme"] });
      expect(await response.json()).toEqual({ allowList: ["acme"] });
    });

    it("answers 400 with the reason when the changes are invalid", async () => {
      services.updateSettings.mockImplementation(() => {
        throw new InvalidSettingsError("weekStart: Invalid input");
      });

      const response = await putSettings(jsonRequest({ weekStart: 3 }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "weekStart: Invalid input" });
    });

    it("answers 400 when the body is not JSON", async () => {
      const response = await putSettings(jsonRequest("not json"));

      expect(response.status).toBe(400);
      expect(services.updateSettings).not.toHaveBeenCalled();
    });
  });
});
