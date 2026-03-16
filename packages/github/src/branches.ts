import { err, ok, Result } from "neverthrow";
import type { ResultAsync } from "neverthrow";
import type { Octokit } from "octokit";

import { withGitHubInstallationClient } from "./client.ts";
import {
  type GitHubAppInstallationAuth,
  type GitHubBranch,
  GitHubError,
} from "./types.ts";

type BranchResponse = Awaited<
  ReturnType<Octokit["rest"]["repos"]["listBranches"]>
>["data"][number];

function toGitHubBranch(
  branch: BranchResponse
): Result<GitHubBranch, GitHubError> {
  const sha = branch.commit?.sha;
  if (typeof sha !== "string" || sha.length === 0) {
    return err(
      new GitHubError("GitHub branch is missing a commit sha", 0, "unknown")
    );
  }

  return ok({
    name: branch.name,
    protected: branch.protected,
    commit: { sha },
  });
}

export function listRepositoryBranches(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string
): ResultAsync<GitHubBranch[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.repos.listBranches, {
      owner,
      repo,
      per_page: 100,
    });
  }).andThen((branches) => Result.combine(branches.map(toGitHubBranch)));
}
