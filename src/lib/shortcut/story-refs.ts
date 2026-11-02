const STORY_REFERENCE = /\bsc-(\d+)\b/gi;

export function storyIdsIn(text: string): string[] {
  const ids = Array.from(text.matchAll(STORY_REFERENCE), (match) => match[1] ?? "");
  return [...new Set(ids)];
}
