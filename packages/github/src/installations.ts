import type { Octokit } from "octokit";

import { account } from "./client.ts";
import type { GitHubInstallation } from "./types.ts";

export async function listInstallations(client: Octokit): Promise<GitHubInstallation[]> {
  const raw = await client.paginate(
    client.rest.apps.listInstallationsForAuthenticatedUser,
    { per_page: 100 },
  );
  return raw.map((i) => ({
    id: i.id,
    account: account(i.account, "installation"),
    app_slug: i.app_slug,
    target_type: i.target_type === "Organization" ? ("Organization" as const) : ("User" as const),
    permissions: i.permissions,
    repository_selection: i.repository_selection,
    created_at: i.created_at,
  }));
}

export function installUrl(slug: string): string {
  return `https://github.com/apps/${slug}/installations/new`;
}
