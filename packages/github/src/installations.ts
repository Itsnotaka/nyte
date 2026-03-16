import { err, ok, Result } from "neverthrow";
import type { ResultAsync } from "neverthrow";

import { toGitHubAccount, withGitHubClient } from "./client.ts";
import { GitHubError, type GitHubInstallation } from "./types.ts";

type InstallationResponse = {
  id: number;
  account: {
    id: number;
    avatar_url: string;
    login?: string;
    slug?: string;
    type?: string;
  } | null;
  app_slug: string;
  target_type: string;
  permissions: Record<string, string>;
  repository_selection: string;
  created_at: string;
};

function targetTypeFromResponse(
  targetType: string
): Result<GitHubInstallation["target_type"], GitHubError> {
  if (targetType === "User" || targetType === "Organization") {
    return ok(targetType);
  }

  return err(
    new GitHubError(
      `GitHub installation has unsupported target type: ${targetType}`,
      0,
      "unknown"
    )
  );
}

function repositorySelectionFromResponse(
  repositorySelection: string
): Result<GitHubInstallation["repository_selection"], GitHubError> {
  if (repositorySelection === "all" || repositorySelection === "selected") {
    return ok(repositorySelection);
  }

  return err(
    new GitHubError(
      `GitHub installation has unsupported repository selection: ${repositorySelection}`,
      0,
      "unknown"
    )
  );
}

function toGitHubInstallation(
  installation: InstallationResponse
): Result<GitHubInstallation, GitHubError> {
  return toGitHubAccount(installation.account, "installation").andThen(
    (account) =>
      targetTypeFromResponse(installation.target_type).andThen((target_type) =>
        repositorySelectionFromResponse(installation.repository_selection).map(
          (repository_selection) => ({
            id: installation.id,
            account,
            app_slug: installation.app_slug,
            target_type,
            permissions: installation.permissions,
            repository_selection,
            created_at: installation.created_at,
          })
        )
      )
  );
}

export function listUserInstallations(
  userAccessToken: string
): ResultAsync<GitHubInstallation[], GitHubError> {
  return withGitHubClient(userAccessToken, async (client) => {
    const installations = await client.paginate(
      client.rest.apps.listInstallationsForAuthenticatedUser,
      { per_page: 100 }
    );
    return installations;
  }).andThen((installations) =>
    Result.combine(installations.map(toGitHubInstallation))
  );
}

export function getInstallUrl(appSlug: string): string {
  return `https://github.com/apps/${appSlug}/installations/new`;
}

export function getInstallUrlForAccount(
  appSlug: string,
  accountLogin: string
): string {
  return `https://github.com/apps/${appSlug}/installations/new/permissions?target_id=${accountLogin}`;
}
