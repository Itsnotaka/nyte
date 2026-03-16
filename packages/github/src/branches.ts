import type { ResultAsync } from "neverthrow";

import { withGitHubInstallationClient } from "./client.ts";
import { type GitHubAppInstallationAuth, type GitHubBranch, GitHubError } from "./types.ts";

export function listRepositoryBranches(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string
): ResultAsync<GitHubBranch[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const branches = await client.paginate(client.rest.repos.listBranches, {
      owner,
      repo,
      per_page: 100,
    });
    return branches.map((branch) => {
      const sha = branch.commit?.sha;
      if (typeof sha !== "string" || sha.length === 0) {
        throw new GitHubError(
          "GitHub branch is missing a commit sha",
          0,
          "unknown"
        );
      }
      return {
        name: branch.name,
        protected: branch.protected,
        commit: { sha },
      };
    });
  });
}
