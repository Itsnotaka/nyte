import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAtColumn = () =>
  timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull();

const updatedAtColumn = () =>
  timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  }).notNull();

const timestampColumn = (name: string) =>
  timestamp(name, {
    withTimezone: true,
    mode: "date",
  }).notNull();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    index("accounts_provider_account_idx").on(
      table.providerId,
      table.accountId
    ),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestampColumn("expires_at"),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampColumn("expires_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    scopes: text("scopes").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    connectedAt: timestampColumn("connected_at"),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("connected_accounts_user_id_idx").on(table.userId)]
);

export const workItems = pgTable(
  "work_items",
  {
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
    importanceTier: text("importance_tier"),
    importanceScore: integer("importance_score"),
    importanceReason: text("importance_reason"),
    importanceVersion: text("importance_version"),
    classifiedAt: timestamp("classified_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("work_items_user_id_idx").on(table.userId),
    index("work_items_user_status_priority_idx").on(
      table.userId,
      table.status,
      table.priorityScore,
      table.updatedAt
    ),
    index("work_items_user_status_importance_idx").on(
      table.userId,
      table.status,
      table.importanceTier,
      table.importanceScore,
      table.updatedAt
    ),
    check(
      "work_items_status_check",
      sql`${table.status} IN ('awaiting_approval', 'completed', 'dismissed')`
    ),
    check(
      "work_items_importance_tier_check",
      sql`${table.importanceTier} IS NULL OR ${table.importanceTier} IN ('critical', 'important', 'later')`
    ),
    check(
      "work_items_importance_score_check",
      sql`${table.importanceScore} IS NULL OR (${table.importanceScore} >= 0 AND ${table.importanceScore} <= 100)`
    ),
  ]
);

export const gateEvaluations = pgTable(
  "gate_evaluations",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => workItems.id),
    gate: text("gate").notNull(),
    matched: boolean("matched").notNull(),
    reason: text("reason").notNull(),
    score: integer("score").notNull(),
  },
  (table) => [
    index("gate_evaluations_work_item_id_idx").on(table.workItemId),
    check(
      "gate_evaluations_gate_check",
      sql`${table.gate} IN ('decision', 'time', 'relationship', 'impact', 'watch')`
    ),
    check(
      "gate_evaluations_score_check",
      sql`${table.score} >= 0 AND ${table.score} <= 10`
    ),
  ]
);

export const proposedActions = pgTable(
  "proposed_actions",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => workItems.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    status: text("status").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("proposed_actions_work_item_id_uidx").on(table.workItemId),
    check(
      "proposed_actions_status_check",
      sql`${table.status} IN ('pending', 'executed', 'dismissed')`
    ),
  ]
);

export const gmailDrafts = pgTable(
  "gmail_drafts",
  {
    id: text("id").primaryKey(),
    actionId: text("action_id")
      .notNull()
      .references(() => proposedActions.id, { onDelete: "cascade" }),
    providerDraftId: text("provider_draft_id").notNull(),
    threadId: text("thread_id"),
    syncedAt: timestampColumn("synced_at"),
  },
  (table) => [uniqueIndex("gmail_drafts_action_id_uidx").on(table.actionId)]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    actionId: text("action_id")
      .notNull()
      .references(() => proposedActions.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").notNull(),
    startsAt: timestampColumn("starts_at"),
    endsAt: timestampColumn("ends_at"),
    syncedAt: timestampColumn("synced_at"),
  },
  (table) => [uniqueIndex("calendar_events_action_id_uidx").on(table.actionId)]
);

export const policyRules = pgTable(
  "policy_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    ruleType: text("rule_type").notNull(),
    value: text("value").notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("policy_rules_user_id_idx").on(table.userId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("audit_logs_target_lookup_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt
    ),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => workItems.id, { onDelete: "cascade" }),
    phase: text("phase").notNull(),
    status: text("status").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("workflow_runs_work_item_id_idx").on(table.workItemId),
    check(
      "workflow_runs_phase_check",
      sql`${table.phase} IN ('ingest', 'approve', 'dismiss', 'feedback')`
    ),
    check("workflow_runs_status_check", sql`${table.status} IN ('completed')`),
  ]
);

export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [index("workflow_events_run_id_idx").on(table.runId)]
);

export const feedbackEntries = pgTable(
  "feedback_entries",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .unique()
      .references(() => workItems.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    note: text("note"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check(
      "feedback_entries_rating_check",
      sql`${table.rating} IN ('positive', 'negative')`
    ),
  ]
);

export const ingestionState = pgTable(
  "ingestion_state",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    gmailCursor: text("gmail_cursor"),
    calendarCursor: text("calendar_cursor"),
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
      mode: "date",
    }),
    bootstrapCompletedAt: timestamp("bootstrap_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastError: text("last_error"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("ingestion_state_updated_at_idx").on(table.updatedAt)]
);
