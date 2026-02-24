import { useMemo, useState } from "react";

type GroupedItem<T> = {
  group: string;
  items: T[];
};

type UseFilteredListOptions<T> = {
  items: T[];
  query: string;
  maxItems?: number;
  getLabel: (item: T) => string;
  getKeywords?: (item: T) => string[];
  getGroup?: (item: T) => string;
};

type UseFilteredListResult<T> = {
  filtered: T[];
  groups: GroupedItem<T>[];
  activeIndex: number;
  activeItem: T | null;
  setActiveIndex: (index: number) => void;
  moveActiveIndex: (direction: 1 | -1) => void;
  resetActiveIndex: () => void;
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function matchScore(query: string, candidate: string): number {
  if (!query) {
    return 1;
  }
  if (candidate.startsWith(query)) {
    return 4;
  }
  if (candidate.includes(query)) {
    return 2;
  }
  const queryParts = query.split(" ").filter(Boolean);
  let score = 0;
  for (const part of queryParts) {
    if (candidate.includes(part)) {
      score += 1;
    }
  }
  return score;
}

export function useFilteredList<T>(
  options: UseFilteredListOptions<T>
): UseFilteredListResult<T> {
  const {
    items,
    query,
    maxItems = 12,
    getLabel,
    getKeywords,
    getGroup,
  } = options;
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query);
    const ranked = items
      .map((item) => {
        const label = normalize(getLabel(item));
        const keywords = (getKeywords?.(item) ?? []).map(normalize);
        const score = Math.max(
          matchScore(normalizedQuery, label),
          ...keywords.map((keyword) => matchScore(normalizedQuery, keyword))
        );
        return { item, score };
      })
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, maxItems);

    return ranked.map((row) => row.item);
  }, [getKeywords, getLabel, items, maxItems, query]);

  const groups = useMemo(() => {
    if (!getGroup) {
      return [{ group: "Suggestions", items: filtered }];
    }

    const byGroup = new Map<string, T[]>();
    for (const item of filtered) {
      const key = getGroup(item);
      if (!byGroup.has(key)) {
        byGroup.set(key, []);
      }
      byGroup.get(key)?.push(item);
    }
    return [...byGroup.entries()].map(([group, groupItems]) => ({
      group,
      items: groupItems,
    }));
  }, [filtered, getGroup]);

  const boundedIndex =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);
  const activeItem = filtered[boundedIndex] ?? null;

  function moveActiveIndex(direction: 1 | -1) {
    setActiveIndex((current) => {
      if (filtered.length === 0) {
        return 0;
      }
      const next = current + direction;
      if (next < 0) {
        return filtered.length - 1;
      }
      if (next >= filtered.length) {
        return 0;
      }
      return next;
    });
  }

  function resetActiveIndex() {
    setActiveIndex(0);
  }

  return {
    filtered,
    groups,
    activeIndex: boundedIndex,
    activeItem,
    setActiveIndex,
    moveActiveIndex,
    resetActiveIndex,
  };
}
