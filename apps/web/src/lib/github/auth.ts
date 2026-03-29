import "server-only";
import { installUrl } from "@sachikit/github";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "../auth";
import { env } from "../server/env";
import { isUnauthorized } from "./effect";
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

export function getGitHubAppInstallUrl(): string {
  return installUrl(env.GITHUB_APP_SLUG);
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
