import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_DIRECT_URL or DATABASE_URL is required for drizzle-kit.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
