import "server-only";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

import { env } from "./server/env";

const helpers = convexBetterAuthNextJs({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
});

export const handler: any = helpers.handler;
export const preloadAuthQuery: any = helpers.preloadAuthQuery;
export const isAuthenticated: any = helpers.isAuthenticated;
export const getToken: any = helpers.getToken;
export const fetchAuthQuery: any = helpers.fetchAuthQuery;
export const fetchAuthMutation: any = helpers.fetchAuthMutation;
export const fetchAuthAction: any = helpers.fetchAuthAction;
