import type { Runner } from "@/lib/exec";

export type ShortcutGet = <T>(path: string) => Promise<T>;

const API_PREFIX = "/api/v3";
const PLACEHOLDER_ORIGIN = "http://localhost";

function rawFields(searchParams: URLSearchParams): string[] {
  return [...searchParams].flatMap(([key, value]) => ["-f", `${key}=${value}`]);
}

export function createShortcutGet(run: Runner): ShortcutGet {
  return async <T>(path: string) => {
    const url = new URL(path, PLACEHOLDER_ORIGIN);
    const apiPath = url.pathname.slice(API_PREFIX.length);
    const output = await run("short", ["api", apiPath, ...rawFields(url.searchParams)]);
    return JSON.parse(output) as T;
  };
}
