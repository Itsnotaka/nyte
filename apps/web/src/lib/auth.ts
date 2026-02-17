import { db } from "@nyte/db/client";
import * as schema from "@nyte/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { oAuthProxy } from "better-auth/plugins";

import { env } from "./server/env";

const gmailScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const productionAuthCallbackUrl = `${trimTrailingSlashes(env.BETTER_AUTH_PRODUCTION_URL)}/api/auth/callback/google`;

export const auth = betterAuth({
  appName: "Nyte",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  account: {
    storeStateStrategy: "cookie",
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  plugins: [
    oAuthProxy({
      productionURL: env.BETTER_AUTH_PRODUCTION_URL,
      currentURL: env.BETTER_AUTH_PROXY_URL,
    }),
    nextCookies(),
  ],
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: productionAuthCallbackUrl,
      scope: gmailScopes,
      accessType: "offline",
      prompt: "select_account consent",
    },
  },
});
