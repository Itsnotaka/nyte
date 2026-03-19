import "server-only";
import { cache } from "react";

import { getGitHubAppAuth } from "./auth";
import { getInstallationRepos, getOnboardingState, getSyncedRepoLookupRows } from "./catalog";
import { GitHubRepoContextNotFoundError } from "./errors";
import type { RepoContext } from "./types";

function repoLookupKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

export const findRepoContext = cache(
  async (owner: string, repo: string): Promise<RepoContext | null> => {
    const [state, syncedRows] = await Promise.all([
      getOnboardingState(),
      getSyncedRepoLookupRows(),
    ]);
    if (state.step !== "has_installations") {
      return null;
    }

    const lookupKey = repoLookupKey(owner, repo);
    const matchedRow = syncedRows.find(
      (row) => repoLookupKey(row.ownerLogin, row.repoName) === lookupKey,
    );
    if (!matchedRow) {
      return null;
    }

    const installation = state.installations.find(
      (candidate) => candidate.id === matchedRow.installationId,
    );
    if (!installation) {
      return null;
    }

    const repos = await getInstallationRepos(installation.id);
    const repository =
      repos.find((candidate) => candidate.id === matchedRow.githubRepoId) ??
      repos.find((candidate) => repoLookupKey(candidate.owner.login, candidate.name) === lookupKey);

    if (!repository) {
      return null;
    }

    return {
      installation,
      repository,
      auth: getGitHubAppAuth(installation.id),
    };
  },
);

export async function requireRepoContext(owner: string, repo: string): Promise<RepoContext> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    throw new GitHubRepoContextNotFoundError({
      message: "Repository not found.",
      owner,
      repo,
    });
  }

  return context;
}
