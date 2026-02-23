import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";

import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const authBaseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.BETTER_AUTH_PRODUCTION_URL ??
  process.env.SITE_URL;

// Better Auth component client.
export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
    verbose: false,
  }
);

export const createAuthOptions = (
  ctx: GenericCtx<DataModel>
): BetterAuthOptions =>
  ({
    appName: "Nyte",
    baseURL: authBaseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: GOOGLE_SCOPES,
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
    plugins: [convex({ authConfig })],
  }) satisfies BetterAuthOptions;

// Used by @better-auth/cli during schema generation.
export const options: BetterAuthOptions = createAuthOptions(
  {} as GenericCtx<DataModel>
);

export const createAuth = (
  ctx: GenericCtx<DataModel>
): ReturnType<typeof betterAuth> => {
  return betterAuth(createAuthOptions(ctx));
};
