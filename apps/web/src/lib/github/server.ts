import "server-only";
import {
  listUserInstallations,
  listInstallationRepos,
  getInstallUrl,
  type GitHubInstallation,
  type GitHubRepository,
  GitHubError,
} from "@nyte/github";

import { auth } from "../auth";
import { getSession } from "../auth/server";
import { env } from "../server/env";

type SetupRedirectInput = {
  installationId: number | null;
  setupAction: string | null;
};

export type OnboardingState =
  | { step: "no_session" }
  | { step: "no_github_token" }
  | { step: "no_installation" }
  | {
      step: "has_installations";
      installations: GitHubInstallation[];
    };

async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const result = await auth.api.getAccessToken({
    body: { providerId: "github", userId },
  });
  if (!result) return null;
  return (
    (result as { data?: Record<string, string> }).data?.accessToken ?? null
  );
}

export function getGitHubAppInstallUrl(): string {
  return getInstallUrl(env.GITHUB_APP_SLUG);
}

export function resolveGitHubAppSetupRedirect({
  installationId,
  setupAction,
}: SetupRedirectInput): { redirectTo: "/setup" | "/setup/repos" } {
  if (setupAction === "install" && installationId) {
    return { redirectTo: "/setup/repos" };
  }

  return { redirectTo: "/setup" };
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) return { step: "no_session" };

  const token = await getGitHubAccessToken(session.user.id);
  if (!token) return { step: "no_github_token" };

  try {
    const installations = await listUserInstallations(token);
    const appInstallations = installations.filter(
      (installation) => installation.app_slug === env.GITHUB_APP_SLUG
    );

    if (appInstallations.length === 0) {
      return { step: "no_installation" };
    }

    return {
      step: "has_installations",
      installations: appInstallations,
    };
  } catch (error) {
    if (error instanceof GitHubError && error.code === "unauthorized") {
      return { step: "no_github_token" };
    }
    throw error;
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
