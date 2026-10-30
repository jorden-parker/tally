import { describe, expect, it } from "vitest";
import type { TallyEvent } from "@/lib/store/events";
import { filterToAllowList, isAllowed, uncountedRepos } from "./allow-list";

const event = (repo: string | null): TallyEvent => ({
  source: "github",
  kind: "pr_created",
  externalId: String(repo),
  occurredAt: "2026-10-30T10:00:00Z",
  repo,
  title: "t",
  url: "u",
});

describe("isAllowed", () => {
  it("allows every repo under a listed owner", () => {
    expect(isAllowed("acme/api", ["acme"])).toBe(true);
    expect(isAllowed("acme/web", ["acme"])).toBe(true);
  });

  it("allows only the exact repo when an owner/repo is listed", () => {
    expect(isAllowed("me/side-project", ["me/side-project"])).toBe(true);
    expect(isAllowed("me/other", ["me/side-project"])).toBe(false);
  });

  it("ignores case", () => {
    expect(isAllowed("Acme/Api", ["acme"])).toBe(true);
  });

  it("does not treat a longer owner name as a match", () => {
    expect(isAllowed("acme-labs/api", ["acme"])).toBe(false);
  });

  it("allows nothing when the list is empty", () => {
    expect(isAllowed("acme/api", [])).toBe(false);
  });
});

describe("filterToAllowList", () => {
  it("keeps only events in allowed repos", () => {
    const kept = filterToAllowList([event("acme/api"), event("other/api"), event(null)], ["acme"]);

    expect(kept.map((item) => item.repo)).toEqual(["acme/api"]);
  });
});

describe("uncountedRepos", () => {
  it("names each repo outside the allow-list once, sorted, skipping allowed and unknown repos", () => {
    const events = [
      event("stranger/lib"),
      event("acme/api"),
      event("zeta/tool"),
      event("stranger/lib"),
      event(null),
    ];

    expect(uncountedRepos(events, ["acme"])).toEqual(["stranger/lib", "zeta/tool"]);
  });
});
