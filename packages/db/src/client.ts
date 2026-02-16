import os from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const defaultDbPath = path.join(os.tmpdir(), "nyte-dev.sqlite");

const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export function resolveDatabaseUrl(rawDatabaseUrl = process.env.DATABASE_URL): string {
  const normalized = rawDatabaseUrl?.trim();
  if (!normalized) {
    return `file:${defaultDbPath}`;
  }

  if (normalized.startsWith("file:")) {
    return normalized;
  }

  if (URL_SCHEME_PATTERN.test(normalized)) {
    return normalized;
  }

  return `file:${path.resolve(normalized)}`;
}

const dbUrl = resolveDatabaseUrl();
const sqlite = createClient({ url: dbUrl });

export const db = drizzle(sqlite, { schema });
export { schema };
