import type { ResultAsync } from "neverthrow";

import { accountFromResponse, withGitHubClient } from "./client.ts";
import { GitHubError, type GitHubRepository } from "./types.ts";

export function listInstallationRepos(
  userAccessToken: string,
  installationId: number
): ResultAsync<GitHubRepository[], GitHubError> {
  return withGitHubClient(userAccessToken, async (client) => {
    const repositories = await client.paginate(
      client.rest.apps.listInstallationReposForAuthenticatedUser,
      {
        installation_id: installationId,
        per_page: 100,
      }
    );
    return repositories.map((repository) => {
      if (!repository.updated_at) {
        throw new GitHubError(
          "GitHub repository is missing an updated_at timestamp",
          0,
          "unknown"
        );
      }

      return {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        private: repository.private,
        owner: accountFromResponse(repository.owner, "repository owner"),
        description: repository.description,
        default_branch: repository.default_branch,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        updated_at: repository.updated_at,
      };
    });
  });
}
