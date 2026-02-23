import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

// Required for PlanetScale Postgres connections
neonConfig.pipelineConnect = false;
neonConfig.wsProxy = (host, port) => `${host}/v2?address=${host}:${port}`;

const connectionString =
  process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
if (!connectionString || connectionString.trim().length === 0) {
  throw new Error("DATABASE_POOL_URL or DATABASE_URL is required.");
}

const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool });
