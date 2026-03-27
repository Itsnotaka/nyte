import "server-only";
import {
  getAuthenticatedGitHubAccount,
  getInstallUrl,
  type GitHubAppInstallationAuth,
} from "@sachikit/github";
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

const renew = cache(async (): Promise<string | null> => {
  const h = await headers();
  try {
    const result = await auth.api.refreshToken({
      body: { providerId: "github" },
      headers: h,
    });
    return result?.accessToken ?? null;
  } catch {
    return null;
  }
});

export async function withToken<T>(run: (token: string) => Promise<T>): Promise<T | null> {
  const token = await getGitHubUserToken();
  if (!token) {
    return null;
  }

  try {
    return await run(token);
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }
  }

  const fresh = await renew();
  if (!fresh) {
    return null;
  }

  try {
    return await run(fresh);
  } catch (error) {
    if (isUnauthorized(error)) {
      return null;
    }

    throw error;
  }
}

export function getGitHubInstallationAuth(installationId: number): GitHubAppInstallationAuth {
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
}: SetupRedirectInput): { redirectTo: "/" | "/setup" } {
  if (setupAction === "install" && installationId) {
    return { redirectTo: "/" };
  }

  return { redirectTo: "/setup" };
}

export const getGitHubUserLogin = cache(async (): Promise<string | null> => {
  const account = await withToken((token) =>
    runGitHubEffectOrNotFound(getAuthenticatedGitHubAccount(token)),
  );
  if (!account) {
    return null;
  }

  return account.login ?? null;
});
