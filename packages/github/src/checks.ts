import type { ResultAsync } from "neverthrow";

import { withGitHubInstallationClient } from "./client.ts";
import {
  type GitHubAppInstallationAuth,
  type GitHubCheckRun,
  type GitHubCheckSummary,
  type GitHubError,
} from "./types.ts";

export function summarizeCheckRuns(
  runs: GitHubCheckRun[]
): GitHubCheckSummary {
  const total = runs.length;
  const passing = runs.filter(
    (r) => r.status === "completed" && r.conclusion === "success"
  ).length;
  const failing = runs.filter(
    (r) =>
      r.status === "completed" &&
      (r.conclusion === "failure" ||
        r.conclusion === "timed_out" ||
        r.conclusion === "action_required")
  ).length;
  const pending = total - passing - failing;

  const conclusion: GitHubCheckSummary["conclusion"] =
    total === 0
      ? "neutral"
      : failing > 0
        ? "failure"
        : pending > 0
          ? "pending"
          : "success";

  return { total, passing, failing, pending, conclusion };
}

export function listCheckRunsForRef(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  ref: string,
): ResultAsync<GitHubCheckRun[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.checks.listForRef({
      owner,
      repo,
      ref,
      per_page: 100,
    });
    return response.data.check_runs.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.status as GitHubCheckRun["status"],
      conclusion: (run.conclusion as string) ?? null,
      started_at: run.started_at ?? null,
      completed_at: run.completed_at ?? null,
      html_url: run.html_url ?? "",
      app: run.app ? { name: run.app.name ?? "", slug: run.app.slug ?? "" } : null,
    }));
  });
}

export function getCheckSummaryForRef(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  ref: string,
): ResultAsync<GitHubCheckSummary, GitHubError> {
  return listCheckRunsForRef(auth, owner, repo, ref).map(summarizeCheckRuns);
}
