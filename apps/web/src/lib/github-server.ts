import "server-only";
import {
  listUserInstallations,
  listInstallationRepos,
  getInstallUrl,
  type GitHubInstallation,
  type GitHubRepository,
  GitHubError,
} from "@nyte/github";

import { auth } from "./auth";
import { getSession } from "./auth-server";
import { env } from "./server/env";

async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const result = await auth.api.getAccessToken({
    body: { providerId: "github", userId },
  });
  if (!result) return null;
  return (
    (result as { data?: Record<string, string> }).data?.accessToken ?? null
  );
}

export type OnboardingState =
  | { step: "no_session" }
  | { step: "no_github_token" }
  | { step: "no_installation"; appInstallUrl: string }
  | {
      step: "has_installations";
      installations: GitHubInstallation[];
      appInstallUrl: string;
    };

export async function getOnboardingState(): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) return { step: "no_session" };

  const token = await getGitHubAccessToken(session.user.id);
  if (!token) return { step: "no_github_token" };

  const appInstallUrl = getInstallUrl(env.GITHUB_APP_SLUG);

  try {
    const installations = await listUserInstallations(token);
    const appInstallations = installations.filter(
      (i) => i.app_slug === env.GITHUB_APP_SLUG
    );

    if (appInstallations.length === 0) {
      return { step: "no_installation", appInstallUrl };
    }

    return {
      step: "has_installations",
      installations: appInstallations,
      appInstallUrl,
    };
  } catch (e) {
    if (e instanceof GitHubError && e.code === "unauthorized") {
      return { step: "no_github_token" };
    }
    throw e;
  }
}

export async function getInstallationRepos(
  installationId: number
): Promise<GitHubRepository[]> {
  const session = await getSession();
  if (!session) return [];

  const token = await getGitHubAccessToken(session.user.id);
  if (!token) return [];

  return listInstallationRepos(token, installationId);
}
