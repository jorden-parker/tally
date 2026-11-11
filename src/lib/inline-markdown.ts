export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong" | "emphasis" | "strikethrough"; children: InlineNode[] };

type WrapperKind = "strong" | "emphasis" | "strikethrough";

const DELIMITERS: { marker: string; kind: WrapperKind }[] = [
  { marker: "**", kind: "strong" },
  { marker: "__", kind: "strong" },
  { marker: "~~", kind: "strikethrough" },
  { marker: "*", kind: "emphasis" },
  { marker: "_", kind: "emphasis" },
];

const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const WHITESPACE = /\s/;

function isEscape(text: string, index: number): boolean {
  return text[index] === "\\" && ASCII_PUNCTUATION.test(text[index + 1] ?? "");
}

function backtickRunLength(text: string, index: number): number {
  let length = 0;
  while (text[index + length] === "`") length += 1;
  return length;
}

function findCodeSpan(text: string, start: number): { code: string; end: number } | null {
  const openLength = backtickRunLength(text, start);
  let cursor = start + openLength;
  while (cursor < text.length) {
    if (text[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    const closeLength = backtickRunLength(text, cursor);
    if (closeLength === openLength) {
      return {
        code: trimCodePadding(text.slice(start + openLength, cursor)),
        end: cursor + closeLength,
      };
    }
    cursor += closeLength;
  }
  return null;
}

function trimCodePadding(code: string): string {
  const isPadded =
    code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "";
  return isPadded ? code.slice(1, -1) : code;
}

function skipAtomic(text: string, index: number): number {
  if (isEscape(text, index)) return index + 2;
  if (text[index] === "`") {
    const span = findCodeSpan(text, index);
    return span === null ? index + backtickRunLength(text, index) : span.end;
  }
  return index + 1;
}

function canOpen(text: string, index: number, marker: string): boolean {
  const following = text[index + marker.length] ?? "";
  if (following === "" || WHITESPACE.test(following)) return false;
  return !(marker.startsWith("_") && WORD_CHARACTER.test(text[index - 1] ?? ""));
}

function canClose(text: string, index: number, marker: string): boolean {
  const preceding = text[index - 1] ?? "";
  if (WHITESPACE.test(preceding)) return false;
  return !(marker.startsWith("_") && WORD_CHARACTER.test(text[index + marker.length] ?? ""));
}

function findCloser(text: string, start: number, marker: string): number | null {
  let cursor = start;
  while (cursor < text.length) {
    if (text.startsWith(marker, cursor)) {
      const isDoubledSingle = marker.length === 1 && text[cursor + 1] === marker;
      if (isDoubledSingle) {
        cursor += 2;
        continue;
      }
      if (cursor > start && canClose(text, cursor, marker)) return cursor;
    }
    cursor = skipAtomic(text, cursor);
  }
  return null;
}

function findLink(text: string, start: number): { label: string; end: number } | null {
  let depth = 0;
  let cursor = start;
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) break;
    }
    cursor = skipAtomic(text, cursor);
  }
  if (depth !== 0 || text[cursor + 1] !== "(") return null;
  const destinationEnd = text.indexOf(")", cursor + 2);
  if (destinationEnd === -1) return null;
  return { label: text.slice(start + 1, cursor), end: destinationEnd + 1 };
}

type Token = { nodes: InlineNode[]; literal: string; end: number };

function readEscape(text: string, start: number): Token | null {
  return isEscape(text, start) ? { nodes: [], literal: text[start + 1], end: start + 2 } : null;
}

function readCode(text: string, start: number): Token | null {
  if (text[start] !== "`") return null;
  const span = findCodeSpan(text, start);
  if (span !== null)
    return { nodes: [{ kind: "code", text: span.code }], literal: "", end: span.end };
  const runEnd = start + backtickRunLength(text, start);
  return { nodes: [], literal: text.slice(start, runEnd), end: runEnd };
}

function readLink(text: string, start: number): Token | null {
  if (text[start] !== "[") return null;
  const link = findLink(text, start);
  return link === null
    ? null
    : { nodes: parseInlineMarkdown(link.label), literal: "", end: link.end };
}

function readDelimited(text: string, start: number): Token | null {
  const delimiter = DELIMITERS.find(
    ({ marker }) => text.startsWith(marker, start) && canOpen(text, start, marker),
  );
  if (delimiter === undefined) return null;
  const contentStart = start + delimiter.marker.length;
  const closer = findCloser(text, contentStart, delimiter.marker);
  if (closer === null) return null;
  const children = parseInlineMarkdown(text.slice(contentStart, closer));
  return {
    nodes: [{ kind: delimiter.kind, children }],
    literal: "",
    end: closer + delimiter.marker.length,
  };
}

const TOKEN_READERS = [readEscape, readCode, readLink, readDelimited];

function readToken(text: string, start: number): Token {
  for (const read of TOKEN_READERS) {
    const token = read(text, start);
    if (token !== null) return token;
  }
  return { nodes: [], literal: text[start], end: start + 1 };
}

export function parseInlineMarkdown(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let pendingText = "";
  let cursor = 0;
  while (cursor < text.length) {
    const token = readToken(text, cursor);
    pendingText += token.literal;
    if (token.nodes.length > 0) {
      if (pendingText !== "") nodes.push({ kind: "text", text: pendingText });
      pendingText = "";
      nodes.push(...token.nodes);
    }
    cursor = token.end;
  }
  if (pendingText !== "") nodes.push({ kind: "text", text: pendingText });
  return nodes;
}
