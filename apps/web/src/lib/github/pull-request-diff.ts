import { queryOptions } from "@tanstack/react-query";

const ttl = 8 * 60 * 60 * 1000;

function baseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function pathUrl(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Request failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export type PullRequestDiffRef = {
  owner: string;
  repo: string;
  pullNumber: number;
  baseSha: string;
  headSha: string;
};

export type PullRequestDiffFileRef = PullRequestDiffRef & {
  path: string;
};

export type PullRequestDiffSummaryFile = {
  name: string;
  prevName: string | null;
  type: string;
  additions: number;
  deletions: number;
};

export type PullRequestDiffSummaryData = {
  files: PullRequestDiffSummaryFile[];
};

export type PullRequestDiffFileData = {
  file: import("@pierre/diffs").FileDiffMetadata;
};

export function getPullRequestDiffSummaryUrl(input: PullRequestDiffRef) {
  const search = new URLSearchParams({ baseSha: input.baseSha, headSha: input.headSha });
  return `${baseUrl()}/api/github/pr/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/${input.pullNumber}/diff?${search}`;
}

export function getPullRequestDiffFileUrl(input: PullRequestDiffFileRef) {
  const search = new URLSearchParams({ baseSha: input.baseSha, headSha: input.headSha });
  return `${baseUrl()}/api/github/pr/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/${input.pullNumber}/diff-file/${pathUrl(input.path)}?${search}`;
}

export function getPullRequestDiffSummaryOptions(input: PullRequestDiffRef) {
  return queryOptions({
    gcTime: ttl,
    queryFn: () => readJson<PullRequestDiffSummaryData>(getPullRequestDiffSummaryUrl(input)),
    queryKey: [
      "github",
      "pull-request-diff",
      "summary",
      input.owner,
      input.repo,
      input.pullNumber,
      input.baseSha,
      input.headSha,
    ] as const,
    staleTime: ttl,
  });
}

export function getPullRequestDiffFileOptions(input: PullRequestDiffFileRef) {
  return queryOptions({
    gcTime: ttl,
    queryFn: () => readJson<PullRequestDiffFileData>(getPullRequestDiffFileUrl(input)),
    queryKey: [
      "github",
      "pull-request-diff",
      "file",
      input.owner,
      input.repo,
      input.pullNumber,
      input.baseSha,
      input.headSha,
      input.path,
    ] as const,
    staleTime: ttl,
  });
}
