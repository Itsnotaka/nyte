import { githubFetch } from "./client.ts";
import type { GitHubRepository } from "./types.ts";

type InstallationReposResponse = {
  total_count: number;
  repositories: GitHubRepository[];
};

export async function listInstallationRepos(
  userAccessToken: string,
  installationId: number
): Promise<GitHubRepository[]> {
  const data = await githubFetch<InstallationReposResponse>(
    `/user/installations/${String(installationId)}/repositories`,
    userAccessToken
  );
  return data.repositories;
}
