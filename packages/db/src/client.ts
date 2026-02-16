import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, "../data/nyte.sqlite");

const resolvedDbPath = process.env.DATABASE_URL
  ? path.resolve(process.env.DATABASE_URL)
  : defaultDbPath;
const dbUrl = resolvedDbPath.startsWith("file:") ? resolvedDbPath : `file:${resolvedDbPath}`;
const sqlite = createClient({ url: dbUrl });

export const db = drizzle(sqlite, { schema });
export { schema };
