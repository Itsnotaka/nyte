import { err, ok, Result } from "neverthrow";
import type { ResultAsync } from "neverthrow";

import { toGitHubAccount, withGitHubClient } from "./client.ts";
import { GitHubError, type GitHubRepository } from "./types.ts";

type RepositoryResponse = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    id: number;
    avatar_url: string;
    login?: string;
    slug?: string;
    type?: string;
  } | null;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string | null;
};

function updatedAtFromResponse(
  updatedAt: string | null
): Result<string, GitHubError> {
  if (typeof updatedAt === "string") {
    return ok(updatedAt);
  }

  return err(
    new GitHubError(
      "GitHub repository is missing an updated_at timestamp",
      0,
      "unknown"
    )
  );
}

function toGitHubRepository(
  repository: RepositoryResponse
): Result<GitHubRepository, GitHubError> {
  return toGitHubAccount(repository.owner, "repository owner").andThen(
    (owner) =>
      updatedAtFromResponse(repository.updated_at).map((updated_at) => ({
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        private: repository.private,
        owner,
        description: repository.description,
        default_branch: repository.default_branch,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        updated_at,
      }))
  );
}

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
    return repositories;
  }).andThen((repositories) =>
    Result.combine(repositories.map(toGitHubRepository))
  );
}
