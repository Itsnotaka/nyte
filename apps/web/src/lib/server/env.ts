import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    CONVEX_URL: z.url(),
    CONVEX_SITE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    SITE_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    DATABASE_URL: z.url(),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_PRODUCTION_URL: z.url(),
    NYTE_TOKEN_ENCRYPTION_KEY: z.string().min(1),
  },
  runtimeEnv: {
    CONVEX_URL: process.env.CONVEX_URL,
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    SITE_URL: process.env.SITE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_PRODUCTION_URL: process.env.BETTER_AUTH_PRODUCTION_URL,
    NYTE_TOKEN_ENCRYPTION_KEY: process.env.NYTE_TOKEN_ENCRYPTION_KEY,
  },
  emptyStringAsUndefined: true,
});
