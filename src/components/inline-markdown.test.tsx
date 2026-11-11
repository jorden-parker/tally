import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineMarkdown } from "./inline-markdown";

describe("InlineMarkdown", () => {
  it("renders code, strong, emphasis and strikethrough without raw markers", () => {
    const { container } = render(
      <InlineMarkdown text="Rename `userId` in **auth** and *docs*, ~~old~~ [link](https://example.com)" />,
    );

    expect(container.querySelector("code")?.textContent).toBe("userId");
    expect(container.querySelector("strong")?.textContent).toBe("auth");
    expect(container.querySelector("em")?.textContent).toBe("docs");
    expect(container.querySelector("del")?.textContent).toBe("old");
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("Rename userId in auth and docs, old link");
  });

  it("nests markup", () => {
    const { container } = render(<InlineMarkdown text="**use `a*b`**" />);

    expect(container.querySelector("strong code")?.textContent).toBe("a*b");
  });
});
