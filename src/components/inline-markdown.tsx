import type { ReactNode } from "react";
import { type InlineNode, parseInlineMarkdown } from "@/lib/inline-markdown";

const WRAPPER_TAGS = { strong: "strong", emphasis: "em", strikethrough: "del" } as const;

function renderNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.kind === "text") return node.text;
    if (node.kind === "code") {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {node.text}
        </code>
      );
    }
    const Tag = WRAPPER_TAGS[node.kind];
    return <Tag key={index}>{renderNodes(node.children)}</Tag>;
  });
}

export function InlineMarkdown({ text }: { text: string }) {
  return <>{renderNodes(parseInlineMarkdown(text))}</>;
}
