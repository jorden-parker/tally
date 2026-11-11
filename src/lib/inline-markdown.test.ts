import { describe, expect, it } from "vitest";
import { parseInlineMarkdown } from "./inline-markdown";

describe("parseInlineMarkdown", () => {
  it("keeps plain text as one text node", () => {
    expect(parseInlineMarkdown("Fix the login page")).toEqual([
      { kind: "text", text: "Fix the login page" },
    ]);
  });

  it("returns no nodes for an empty string", () => {
    expect(parseInlineMarkdown("")).toEqual([]);
  });

  it("turns backtick spans into code", () => {
    expect(parseInlineMarkdown("Rename `userId` to `accountId`")).toEqual([
      { kind: "text", text: "Rename " },
      { kind: "code", text: "userId" },
      { kind: "text", text: " to " },
      { kind: "code", text: "accountId" },
    ]);
  });

  it("closes a code span only on a backtick run of the same length", () => {
    expect(parseInlineMarkdown("Use ``a ` b`` here")).toEqual([
      { kind: "text", text: "Use " },
      { kind: "code", text: "a ` b" },
      { kind: "text", text: " here" },
    ]);
  });

  it("strips one space from each side of padded code", () => {
    expect(parseInlineMarkdown("`` `tick` ``")).toEqual([{ kind: "code", text: "`tick`" }]);
  });

  it("leaves an unmatched backtick as text", () => {
    expect(parseInlineMarkdown("Quote ` mark")).toEqual([{ kind: "text", text: "Quote ` mark" }]);
  });

  it("does not parse emphasis inside code", () => {
    expect(parseInlineMarkdown("`**not bold**`")).toEqual([{ kind: "code", text: "**not bold**" }]);
  });

  it("parses strong, emphasis and strikethrough", () => {
    expect(parseInlineMarkdown("**bold** *italic* _also_ __strong__ ~~gone~~")).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "bold" }] },
      { kind: "text", text: " " },
      { kind: "emphasis", children: [{ kind: "text", text: "italic" }] },
      { kind: "text", text: " " },
      { kind: "emphasis", children: [{ kind: "text", text: "also" }] },
      { kind: "text", text: " " },
      { kind: "strong", children: [{ kind: "text", text: "strong" }] },
      { kind: "text", text: " " },
      { kind: "strikethrough", children: [{ kind: "text", text: "gone" }] },
    ]);
  });

  it("nests code and emphasis inside each other", () => {
    expect(parseInlineMarkdown("**use `a*b` now**")).toEqual([
      {
        kind: "strong",
        children: [
          { kind: "text", text: "use " },
          { kind: "code", text: "a*b" },
          { kind: "text", text: " now" },
        ],
      },
    ]);
  });

  it("leaves underscores inside words alone", () => {
    expect(parseInlineMarkdown("Drop snake_case_name column")).toEqual([
      { kind: "text", text: "Drop snake_case_name column" },
    ]);
  });

  it("leaves delimiters surrounded by spaces alone", () => {
    expect(parseInlineMarkdown("2 * 3 * 4")).toEqual([{ kind: "text", text: "2 * 3 * 4" }]);
  });

  it("leaves an unclosed delimiter as text", () => {
    expect(parseInlineMarkdown("**open ended")).toEqual([{ kind: "text", text: "**open ended" }]);
  });

  it("renders a link as its label text", () => {
    expect(parseInlineMarkdown("See [the `docs`](https://example.com) first")).toEqual([
      { kind: "text", text: "See " },
      { kind: "text", text: "the " },
      { kind: "code", text: "docs" },
      { kind: "text", text: " first" },
    ]);
  });

  it("keeps brackets that are not a link", () => {
    expect(parseInlineMarkdown("[WIP] add tests")).toEqual([
      { kind: "text", text: "[WIP] add tests" },
    ]);
  });

  it("treats backslash-escaped punctuation as literal", () => {
    expect(parseInlineMarkdown("\\*not italic\\* and \\`tick\\`")).toEqual([
      { kind: "text", text: "*not italic* and `tick`" },
    ]);
  });
});
