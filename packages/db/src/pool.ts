import { Pool } from "pg";

declare global {
  var __nyteDatabasePools__: Map<string, Pool> | undefined;
}

const poolCache =
  globalThis.__nyteDatabasePools__ ??= new Map<string, Pool>();

export function getPostgresPool(connectionString: string): Pool {
  const existingPool = poolCache.get(connectionString);
  if (existingPool) {
    return existingPool;
  }

  // Next.js dev hot reload re-runs module scope, so cache pools on globalThis
  // and key them by connection string to avoid opening duplicate connections.
  const pool = new Pool({ connectionString });
  poolCache.set(connectionString, pool);

  return pool;
}
