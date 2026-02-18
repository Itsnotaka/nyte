import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Required for PlanetScale Postgres connections
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error("DATABASE_URL is required to initialize @nyte/db client.");
  }

  return url;
}

const sql = neon(resolveDatabaseUrl());

export const db = drizzle(sql, { schema });
