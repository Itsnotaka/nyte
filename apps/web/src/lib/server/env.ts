import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    NYTE_TOKEN_ENCRYPTION_KEY: z.string().min(1),
    NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().min(1).optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    NYTE_TOKEN_ENCRYPTION_KEY: process.env.NYTE_TOKEN_ENCRYPTION_KEY,
    NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS:
      process.env.NYTE_TOKEN_ENCRYPTION_KEY_PREVIOUS,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  },
  emptyStringAsUndefined: true,
});

export type ServerEnvironment = typeof env;
