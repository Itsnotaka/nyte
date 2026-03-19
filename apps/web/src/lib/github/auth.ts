import "server-only";
import type { GitHubAppInstallationAuth } from "@sachikit/github";
import { getInstallUrl, withGitHubClient } from "@sachikit/github";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "../auth";
import { env } from "../server/env";
import { runGitHubEffectOrNull } from "./effect";
import { GitHubAppConfigurationError } from "./errors";
import type { SetupRedirectInput } from "./types";

const getGitHubAccessToken = cache(async (): Promise<string | null> => {
  const h = await headers();
  const result = await auth.api.getAccessToken({
    body: { providerId: "github" },
    headers: h,
  });
  return result?.accessToken ?? null;
});

export function getGitHubAppAuth(installationId: number): GitHubAppInstallationAuth {
  const appId = Number(env.GITHUB_APP_ID);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new GitHubAppConfigurationError({
      message: "Invalid GitHub app configuration.",
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

export const getAuthenticatedGitHubLogin = cache(async (): Promise<string | null> => {
  const token = await getGitHubAccessToken();
  if (!token) return null;

  return runGitHubEffectOrNull(
    withGitHubClient(
      token,
      async (client) => {
        const { data } = await client.rest.users.getAuthenticated();
        return data.login;
      },
      { operation: "github.auth.getAuthenticatedGitHubLogin" },
    ),
  );
});

export { getGitHubAccessToken };
