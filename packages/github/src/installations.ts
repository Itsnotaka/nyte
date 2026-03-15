import { GitHubError, type GitHubInstallation } from "./types.ts";
import { toGitHubAccount, withGitHubClient } from "./client.ts";

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
): GitHubInstallation["target_type"] {
  if (targetType === "User" || targetType === "Organization") {
    return targetType;
  }

  throw new GitHubError(
    `GitHub installation has unsupported target type: ${targetType}`,
    0,
    "unknown"
  );
}

function repositorySelectionFromResponse(
  repositorySelection: string
): GitHubInstallation["repository_selection"] {
  if (repositorySelection === "all" || repositorySelection === "selected") {
    return repositorySelection;
  }

  throw new GitHubError(
    `GitHub installation has unsupported repository selection: ${repositorySelection}`,
    0,
    "unknown"
  );
}

function toGitHubInstallation(
  installation: InstallationResponse
): GitHubInstallation {
  return {
    id: installation.id,
    account: toGitHubAccount(installation.account, "installation"),
    app_slug: installation.app_slug,
    target_type: targetTypeFromResponse(installation.target_type),
    permissions: installation.permissions,
    repository_selection: repositorySelectionFromResponse(
      installation.repository_selection
    ),
    created_at: installation.created_at,
  };
}

export async function listUserInstallations(
  userAccessToken: string
): Promise<GitHubInstallation[]> {
  return withGitHubClient(userAccessToken, async (client) => {
    const installations = await client.paginate(
      client.rest.apps.listInstallationsForAuthenticatedUser,
      { per_page: 100 }
    );

    return installations.map(toGitHubInstallation);
  });
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
