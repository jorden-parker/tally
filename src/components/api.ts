import type { Range, Summary } from "@/lib/metrics/summary";
import type { Settings } from "@/lib/store/settings";
import type { SyncResult } from "@/lib/sync";

export type SettingsChanges = Partial<Pick<Settings, "allowList" | "weekStart" | "timeZone">>;

export type TallyApi = {
  fetchSummary: (range: Range) => Promise<Summary>;
  fetchSettings: () => Promise<Settings>;
  runSync: () => Promise<SyncResult>;
  saveSettings: (changes: SettingsChanges) => Promise<Settings>;
};

const JSON_HEADERS = { "content-type": "application/json" };

async function failureMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error ?? `Request failed with status ${response.status}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await failureMessage(response));
  return (await response.json()) as T;
}

function sendJson(method: string, body: unknown): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export const api: TallyApi = {
  fetchSummary: (range) => request(`/api/metrics?range=${range}`),
  fetchSettings: () => request("/api/settings"),
  runSync: () => request("/api/sync", sendJson("POST", {})),
  saveSettings: (changes) => request("/api/settings", sendJson("PUT", changes)),
};
