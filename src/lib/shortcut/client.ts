export type ShortcutGet = <T>(path: string) => Promise<T>;

const API_ORIGIN = "https://api.app.shortcut.com";

export function createShortcutGet(token: string, fetchImpl: typeof fetch = fetch): ShortcutGet {
  return async <T>(path: string) => {
    const response = await fetchImpl(`${API_ORIGIN}${path}`, {
      headers: { "Shortcut-Token": token, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Shortcut ${path} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  };
}
