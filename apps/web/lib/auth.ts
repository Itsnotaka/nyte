import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@workspace/db";
import { getBetterAuthSecret } from "./server/runtime-secrets";

const gmailScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
];

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const betterAuthSecret = getBetterAuthSecret();

export const auth = betterAuth({
  appName: "Nyte",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: betterAuthSecret.value,
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  plugins: [nextCookies()],
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            scope: gmailScopes,
            accessType: "offline",
            prompt: "consent",
          },
        }
      : {},
});
