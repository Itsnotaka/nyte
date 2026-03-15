import { githubFetch } from "./client.ts";
import type { GitHubInstallation } from "./types.ts";

type InstallationsResponse = {
  total_count: number;
  installations: GitHubInstallation[];
};

export async function listUserInstallations(
  userAccessToken: string
): Promise<GitHubInstallation[]> {
  const data = await githubFetch<InstallationsResponse>(
    "/user/installations",
    userAccessToken
  );
  return data.installations;
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
