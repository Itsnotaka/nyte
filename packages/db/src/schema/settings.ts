import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export type DiffSettingsJson = {
  diffStyle: "unified" | "split";
  hideComments: boolean;
  contextLines: number;
  overflow: "scroll" | "wrap";
  lineDiffType: "word-alt" | "word" | "char" | "none";
};

export const DIFF_SETTINGS_DEFAULTS: DiffSettingsJson = {
  contextLines: 3,
  diffStyle: "split",
  hideComments: false,
  lineDiffType: "word-alt",
  overflow: "scroll",
};

export const userDiffSettings = pgTable("user_diff_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  settings: jsonb("settings").notNull().$type<DiffSettingsJson>(),
  updatedAt: timestamp("updated_at").notNull(),
});

export type InboxSectionOrderJson = string[];

export const DEFAULT_INBOX_SECTION_ORDER: InboxSectionOrderJson = [
  "needs_review",
  "returned",
  "approved",
  "merging",
  "waiting_author",
  "drafts",
  "waiting_reviewers",
];

export const userInboxSectionOrder = pgTable("user_inbox_section_order", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  sectionOrder: jsonb("section_order").notNull().$type<InboxSectionOrderJson>(),
  updatedAt: timestamp("updated_at").notNull(),
});
