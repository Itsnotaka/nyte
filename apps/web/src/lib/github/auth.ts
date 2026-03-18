import "server-only";
import type { GitHubAppInstallationAuth } from "@sachikit/github";
import { getInstallUrl, withGitHubClient } from "@sachikit/github";
import type { Result } from "neverthrow";
import { err, ok, ResultAsync } from "neverthrow";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "../auth";
import { env } from "../server/env";
import type { SetupRedirectInput, TokenError } from "./types";

const getGitHubAccessToken = cache(
  async (): Promise<Result<string, TokenError>> => {
    const h = await headers();
    return ResultAsync.fromPromise(
      auth.api.getAccessToken({ body: { providerId: "github" }, headers: h }),
      (): TokenError => "token_unavailable"
    ).andThen((result) =>
      result?.accessToken
        ? ok(result.accessToken)
        : err<string, TokenError>("token_unavailable")
    );
  }
);

export function getGitHubAppAuth(
  installationId: number
): GitHubAppInstallationAuth {
  const appId = Number(env.GITHUB_APP_ID);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error("Invalid GitHub app configuration.");
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

export const getAuthenticatedGitHubLogin = cache(
  async (): Promise<string | null> => {
    const tokenResult = await getGitHubAccessToken();
    if (tokenResult.isErr()) return null;

    return withGitHubClient(tokenResult.value, async (client) => {
      const { data } = await client.rest.users.getAuthenticated();
      return data.login;
    }).unwrapOr(null);
  }
);

export { getGitHubAccessToken };
