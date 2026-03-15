import { GitHubError, type GitHubRepository } from "./types.ts";
import { toGitHubAccount, withGitHubClient } from "./client.ts";

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

function updatedAtFromResponse(updatedAt: string | null): string {
  if (typeof updatedAt === "string") {
    return updatedAt;
  }

  throw new GitHubError(
    "GitHub repository is missing an updated_at timestamp",
    0,
    "unknown"
  );
}

function toGitHubRepository(repository: RepositoryResponse): GitHubRepository {
  return {
    id: repository.id,
    name: repository.name,
    full_name: repository.full_name,
    private: repository.private,
    owner: toGitHubAccount(repository.owner, "repository owner"),
    description: repository.description,
    default_branch: repository.default_branch,
    language: repository.language,
    stargazers_count: repository.stargazers_count,
    updated_at: updatedAtFromResponse(repository.updated_at),
  };
}

export async function listInstallationRepos(
  userAccessToken: string,
  installationId: number
): Promise<GitHubRepository[]> {
  return withGitHubClient(userAccessToken, async (client) => {
    const repositories = await client.paginate(
      client.rest.apps.listInstallationReposForAuthenticatedUser,
      {
        installation_id: installationId,
        per_page: 100,
      }
    );

    return repositories.map(toGitHubRepository);
  });
}
