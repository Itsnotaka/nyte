import type { ResultAsync } from "neverthrow";

import { accountFromResponse, withGitHubClient } from "./client.ts";
import { type GitHubInstallation } from "./types.ts";
import type { GitHubError } from "./types.ts";

export function listUserInstallations(
  userAccessToken: string
): ResultAsync<GitHubInstallation[], GitHubError> {
  return withGitHubClient(userAccessToken, async (client) => {
    const installations = await client.paginate(
      client.rest.apps.listInstallationsForAuthenticatedUser,
      { per_page: 100 }
    );
    return installations.map((installation) => ({
      id: installation.id,
      account: accountFromResponse(installation.account, "installation"),
      app_slug: installation.app_slug,
      target_type:
        installation.target_type === "Organization" ? "Organization" : "User",
      permissions: installation.permissions,
      repository_selection: installation.repository_selection,
      created_at: installation.created_at,
    }));
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
