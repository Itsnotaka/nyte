import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const connectedAccounts = sqliteTable("connected_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  scopes: text("scopes").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  connectedAt: integer("connected_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const workItems = sqliteTable("work_items", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  source: text("source").notNull(),
  actor: text("actor").notNull(),
  summary: text("summary").notNull(),
  context: text("context").notNull(),
  preview: text("preview").notNull(),
  status: text("status").notNull(),
  priorityScore: integer("priority_score").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const gateEvaluations = sqliteTable("gate_evaluations", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  gate: text("gate").notNull(),
  matched: integer("matched", { mode: "boolean" }).notNull(),
  reason: text("reason").notNull(),
  score: integer("score").notNull(),
});

export const proposedActions = sqliteTable("proposed_actions", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  actionType: text("action_type").notNull(),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const gmailDrafts = sqliteTable("gmail_drafts", {
  id: text("id").primaryKey(),
  actionId: text("action_id")
    .notNull()
    .references(() => proposedActions.id),
  providerDraftId: text("provider_draft_id").notNull(),
  threadId: text("thread_id"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull(),
});

export const calendarEvents = sqliteTable("calendar_events", {
  id: text("id").primaryKey(),
  actionId: text("action_id")
    .notNull()
    .references(() => proposedActions.id),
  providerEventId: text("provider_event_id").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull(),
});

export const policyRules = sqliteTable("policy_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  ruleType: text("rule_type").notNull(),
  value: text("value").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  phase: text("phase").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const workflowEvents = sqliteTable("workflow_events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  kind: text("kind").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const feedbackEntries = sqliteTable("feedback_entries", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .unique()
    .references(() => workItems.id),
  rating: text("rating").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
