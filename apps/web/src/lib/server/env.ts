import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    DATABASE_POOL_URL: z.url().optional(),
    DATABASE_DIRECT_URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_PRODUCTION_URL: z.url(),
    BETTER_AUTH_PROXY_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    PRELOAD_CRON_SECRET: z.string().min(1).optional(),
    PRELOAD_BATCH_SIZE: z.coerce.number().int().positive().max(200).optional(),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_URL: process.env.DATABASE_POOL_URL,
    DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_PRODUCTION_URL: process.env.BETTER_AUTH_PRODUCTION_URL,
    BETTER_AUTH_PROXY_URL: process.env.BETTER_AUTH_PROXY_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    PRELOAD_CRON_SECRET: process.env.PRELOAD_CRON_SECRET,
    PRELOAD_BATCH_SIZE: process.env.PRELOAD_BATCH_SIZE,
  },
  emptyStringAsUndefined: true,
});
