import "server-only";

import { createClient, listInstallations } from "@sachikit/github";
import { cache } from "react";

import { getUserSession } from "../auth/server";
import { env } from "../server/env";
import { withToken } from "./auth";
import type { OnboardingState } from "./types";

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getUserSession();
  if (!session) return { step: "no_user_session" };

  const installs = await withToken((token) => listInstallations(createClient(token)));
  if (!installs) return { step: "no_github_user_token" };

  const matching = installs.filter((i) => i.app_slug === env.GITHUB_APP_SLUG);
  return matching.length === 0
    ? { step: "no_github_installation" }
    : { step: "has_installations", installations: matching };
});
