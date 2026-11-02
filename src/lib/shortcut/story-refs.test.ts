import { describe, expect, it } from "vitest";
import { storyIdsIn } from "./story-refs";

describe("storyIdsIn", () => {
  it("finds story ids in a branch name and a title, whatever the case", () => {
    expect(storyIdsIn("jorden/sc-1234-slug Fix SC-99 and sc-7")).toEqual(["1234", "99", "7"]);
  });

  it("dedupes repeated ids", () => {
    expect(storyIdsIn("sc-12 sc-12")).toEqual(["12"]);
  });

  it("ignores look-alikes without a word boundary", () => {
    expect(storyIdsIn("misc-12 sc-12x escsc-3")).toEqual([]);
  });
});
