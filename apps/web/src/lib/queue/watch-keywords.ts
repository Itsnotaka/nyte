const MIN_WATCH_KEYWORD_LENGTH = 3;
const MAX_WATCH_KEYWORDS = 8;

export function normalizeWatchKeywords(entries: Iterable<string>): string[] {
  const keywords = new Set<string>();

  for (const entry of entries) {
    const keyword = entry.trim().toLowerCase();
    if (keyword.length < MIN_WATCH_KEYWORD_LENGTH) {
      continue;
    }

    keywords.add(keyword);
    if (keywords.size >= MAX_WATCH_KEYWORDS) {
      break;
    }
  }

  return Array.from(keywords);
}

export function parseWatchKeywordCommand(command: string): string[] {
  const normalized = command.trim();
  if (!normalized) {
    return [];
  }

  const candidates = normalized.includes(",")
    ? normalized.split(",")
    : normalized.split(/\s+/);

  return normalizeWatchKeywords(candidates);
}
