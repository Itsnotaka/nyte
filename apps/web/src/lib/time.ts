import { formatDistanceToNow } from "date-fns";

export function formatRelativeTime(
  input: Date | string,
  options: {
    addSuffix?: boolean;
    justNowLabel?: string;
  } = {},
): string {
  const date = input instanceof Date ? input : new Date(input);
  const distance = formatDistanceToNow(date, {
    addSuffix: options.addSuffix ?? true,
    includeSeconds: true,
  });

  if (distance === "less than a minute" || distance === "less than a minute ago") {
    return options.justNowLabel ?? "just now";
  }

  return distance;
}
