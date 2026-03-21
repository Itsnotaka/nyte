import { parseAsString } from "nuqs";

export type InboxPr = {
  owner: string;
  repo: string;
  number: number;
};

export const prState = parseAsString.withOptions({
  history: "push",
  scroll: false,
  shallow: true,
});

export function readPr(value: string | null): InboxPr | null {
  if (value == null) {
    return null;
  }

  const [owner, repo, raw] = value.split("/");
  const number = Number(raw);
  if (!owner || !repo || !Number.isInteger(number) || number <= 0) {
    return null;
  }

  return {
    owner,
    repo,
    number,
  };
}

export function writePr(pr: InboxPr): string {
  return `${pr.owner}/${pr.repo}/${String(pr.number)}`;
}

export function prHref(value: string): string {
  return `/?pr=${encodeURIComponent(value)}`;
}
