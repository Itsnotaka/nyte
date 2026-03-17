import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const prFileViewed = pgTable(
  "pr_file_viewed",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    prId: integer("pr_id").notNull(),
    filePath: text("file_path").notNull(),
    viewedAt: timestamp("viewed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.prId, table.filePath] })],
);
