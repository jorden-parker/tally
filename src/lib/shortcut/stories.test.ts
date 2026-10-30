import { describe, expect, it } from "vitest";
import type { ShortcutGet } from "./client";
import { countInProgressStories, fetchCompletedStories, fetchMentionName } from "./stories";

function story(id: number, completedAt: string | null) {
  return {
    id,
    name: `Story ${id}`,
    app_url: `https://app.shortcut.com/acme/story/${id}`,
    completed_at: completedAt,
  };
}

function queryOf(path: string): string | null {
  return new URL(path, "https://api.app.shortcut.com").searchParams.get("query");
}

describe("fetchMentionName", () => {
  it("reads the mention name of the token's member", async () => {
    const get: ShortcutGet = async <T>() => ({ mention_name: "jorden" }) as T;

    expect(await fetchMentionName(get)).toBe("jorden");
  });
});

describe("fetchCompletedStories", () => {
  const window = { fromDay: "2026-09-01", toDay: "2026-10-31" };

  it("searches my done stories in the window and maps them to events", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return { data: [story(11, "2026-10-28T09:00:00Z")], next: null, total: 1 } as T;
    };

    const events = await fetchCompletedStories(get, "jorden", window);

    expect(queryOf(paths[0])).toBe("owner:jorden is:done completed:2026-09-01..2026-10-31");
    expect(events).toEqual([
      {
        source: "shortcut",
        kind: "story_completed",
        externalId: "11",
        occurredAt: "2026-10-28T09:00:00Z",
        repo: null,
        title: "Story 11",
        url: "https://app.shortcut.com/acme/story/11",
      },
    ]);
  });

  it("follows the next link and skips stories without a completion time", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return (
        paths.length === 1
          ? { data: [story(1, "2026-10-01T09:00:00Z")], next: "/api/v3/search/stories?next=abc" }
          : { data: [story(2, null), story(3, "2026-10-02T09:00:00Z")], next: null }
      ) as T;
    };

    const events = await fetchCompletedStories(get, "jorden", window);

    expect(paths[1]).toBe("/api/v3/search/stories?next=abc");
    expect(events.map((event) => event.externalId)).toEqual(["1", "3"]);
  });
});

describe("countInProgressStories", () => {
  it("returns the total of my started, unfinished stories", async () => {
    const paths: string[] = [];
    const get: ShortcutGet = async <T>(path: string) => {
      paths.push(path);
      return { data: [], next: null, total: 4 } as T;
    };

    expect(await countInProgressStories(get, "jorden")).toBe(4);
    expect(queryOf(paths[0])).toBe("owner:jorden is:started !is:done");
  });
});
