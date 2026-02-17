import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export function resolveDatabaseUrl(rawDatabaseUrl = process.env.DATABASE_URL): string {
  const normalized = rawDatabaseUrl?.trim();
  if (normalized) {
    return normalized;
  }

  return "postgres://postgres:postgres@127.0.0.1:5432/nyte";
}

const dbUrl = resolveDatabaseUrl();
const pool = new Pool({
  connectionString: dbUrl,
  max: 5,
});

export const db = drizzle({
  client: pool,
  schema,
});

export async function ensureDbSchema() {}

export { schema };
