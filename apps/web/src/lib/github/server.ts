import "server-only";
import {
  listUserInstallations,
  listInstallationRepos,
  getInstallUrl,
  type GitHubInstallation,
  type GitHubRepository,
} from "@nyte/github";
import { err, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { headers } from "next/headers";

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

type TokenError = "token_unavailable";

async function getGitHubAccessToken(): Promise<Result<string, TokenError>> {
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

  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return { step: "no_github_token" };

  return listUserInstallations(tokenResult.value).match(
    (installations): OnboardingState => {
      const appInstallations = installations.filter(
        (i) => i.app_slug === env.GITHUB_APP_SLUG
      );
      return appInstallations.length === 0
        ? { step: "no_installation" }
        : { step: "has_installations", installations: appInstallations };
    },
    (error): OnboardingState =>
      error.code === "unauthorized"
        ? { step: "no_github_token" }
        : { step: "no_github_token" }
  );
}

export async function getInstallationRepos(
  installationId: number
): Promise<GitHubRepository[]> {
  const session = await getSession();
  if (!session) return [];

  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return [];

  return listInstallationRepos(tokenResult.value, installationId).unwrapOr([]);
}
