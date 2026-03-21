import "server-only";
import { getAuthenticatedGitHubAccount, getInstallUrl, type GitHubAppInstallationAuth } from "@sachikit/github";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "../auth";
import { env } from "../server/env";
import { isUnauthorized, runGitHubEffectOrNotFound } from "./effect";
import { GitHubAppConfigurationError } from "./errors";
import type { SetupRedirectInput } from "./types";

const getGitHubUserToken = cache(async (): Promise<string | null> => {
  const h = await headers();
  const result = await auth.api.getAccessToken({
    body: { providerId: "github" },
    headers: h,
  });
  return result?.accessToken ?? null;
});

export function getGitHubInstallationAuth(
  installationId: number,
 ): GitHubAppInstallationAuth {
  const appId = Number(env.GITHUB_APP_ID);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new GitHubAppConfigurationError({
      code: "app_configuration_invalid",
      message: "Invalid GitHub app configuration.",
      metadata: { field: "GITHUB_APP_ID", installationId },
      operation: "github.auth.getGitHubInstallationAuth",
      status: 500,
    });
  }

  return {
    appId,
    installationId,
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
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

export const getGitHubUserLogin = cache(async (): Promise<string | null> => {
  const userToken = await getGitHubUserToken();
  if (!userToken) return null;

  try {
    const account = await runGitHubEffectOrNotFound(getAuthenticatedGitHubAccount(userToken));
    return account?.login ?? null;
  } catch (error) {
    if (isUnauthorized(error)) {
      return null;
    }

    throw error;
  }
});

export { getGitHubUserToken };
