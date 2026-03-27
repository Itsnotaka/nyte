import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    /** OAuth Client ID from the same GitHub App (Developer Settings → GitHub App → OAuth credentials). */
    GITHUB_CLIENT_ID: z.string().min(1),
    /** OAuth Client Secret for that app (not a separate “OAuth App” in production). */
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_APP_SLUG: z.string().min(1),
  },
  emptyStringAsUndefined: true,
  experimental__runtimeEnv: {},
});
