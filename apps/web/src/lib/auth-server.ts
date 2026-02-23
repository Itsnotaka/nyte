import "server-only";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

import { env } from "./server/env";

const helpers = convexBetterAuthNextJs({
  convexUrl: env.CONVEX_URL,
  convexSiteUrl: env.CONVEX_SITE_URL,
});

type BetterAuthNextHelpers = ReturnType<typeof convexBetterAuthNextJs>;

export const handler: BetterAuthNextHelpers["handler"] = helpers.handler;
export const preloadAuthQuery: BetterAuthNextHelpers["preloadAuthQuery"] =
  helpers.preloadAuthQuery;
export const isAuthenticated: BetterAuthNextHelpers["isAuthenticated"] =
  helpers.isAuthenticated;
export const getToken: BetterAuthNextHelpers["getToken"] = helpers.getToken;
export const fetchAuthQuery: BetterAuthNextHelpers["fetchAuthQuery"] =
  helpers.fetchAuthQuery;
export const fetchAuthMutation: BetterAuthNextHelpers["fetchAuthMutation"] =
  helpers.fetchAuthMutation;
export const fetchAuthAction: BetterAuthNextHelpers["fetchAuthAction"] =
  helpers.fetchAuthAction;
