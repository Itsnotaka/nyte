export function groupByPath<T extends { path: string }>(items: T[]): Map<string, T[]> {
  return items.reduce((groups, item) => {
    const group = groups.get(item.path);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.path, [item]);
    }
    return groups;
  }, new Map<string, T[]>());
}
