import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, "../data/nyte.sqlite");

const dbPath = process.env.DATABASE_URL ? path.resolve(process.env.DATABASE_URL) : defaultDbPath;
const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
export { schema };
