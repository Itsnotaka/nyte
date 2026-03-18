import "server-only";
import {
  listCheckRunsForRef,
  summarizeCheckRuns,
  type GitHubCheckRun,
  type GitHubCheckSummary,
} from "@sachikit/github";

import { findRepoContext } from "./context";
import type { GitHubCheckRef, GitHubCheckReport } from "./types";

function checkRefKey(input: GitHubCheckRef): string {
  return `${input.owner.toLowerCase()}/${input.repo.toLowerCase()}@${input.ref}`;
}

export async function getCheckReportForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckReport | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const runs = await listCheckRunsForRef(
    context.auth,
    owner,
    context.repository.name,
    ref
  ).unwrapOr([]);

  return {
    runs,
    summary: summarizeCheckRuns(runs),
  };
}

export async function getCheckRunsForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckRun[]> {
  const report = await getCheckReportForPR(owner, repo, ref);
  return report?.runs ?? [];
}

export async function getCheckSummaryForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckSummary | null> {
  const report = await getCheckReportForPR(owner, repo, ref);
  return report?.summary ?? null;
}

export async function getCheckSummariesForRefs(
  refs: GitHubCheckRef[]
): Promise<Record<string, GitHubCheckSummary | null>> {
  const uniqueRefs = Array.from(
    new Map(refs.map((ref) => [checkRefKey(ref), ref])).entries()
  );

  const summaries = await Promise.all(
    uniqueRefs.map(
      async ([key, ref]) =>
        [key, await getCheckSummaryForPR(ref.owner, ref.repo, ref.ref)] as const
    )
  );

  return Object.fromEntries(summaries);
}
