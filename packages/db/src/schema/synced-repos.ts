import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const syncedRepo = pgTable(
  "synced_repo",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    githubRepoId: integer("github_repo_id").notNull(),
    installationId: integer("installation_id").notNull(),
    ownerLogin: text("owner_login").notNull(),
    repoName: text("repo_name").notNull(),
    repoFullName: text("repo_full_name").notNull(),
    isPrivate: integer("is_private").notNull().default(0),
    syncedAt: timestamp("synced_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.githubRepoId] })],
);
