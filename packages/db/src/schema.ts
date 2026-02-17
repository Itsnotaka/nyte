import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
  (table) => ({
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
    providerAccountIdx: index("accounts_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
  }),
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
  (table) => ({
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
  }),
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
  (table) => ({
    identifierIdx: index("verifications_identifier_idx").on(table.identifier),
  }),
);

export const connectedAccounts = pgTable("connected_accounts", {
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
});

export const workItems = pgTable("work_items", {
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
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const gateEvaluations = pgTable("gate_evaluations", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  gate: text("gate").notNull(),
  matched: boolean("matched").notNull(),
  reason: text("reason").notNull(),
  score: integer("score").notNull(),
});

export const proposedActions = pgTable("proposed_actions", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  actionType: text("action_type").notNull(),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const gmailDrafts = pgTable("gmail_drafts", {
  id: text("id").primaryKey(),
  actionId: text("action_id")
    .notNull()
    .references(() => proposedActions.id),
  providerDraftId: text("provider_draft_id").notNull(),
  threadId: text("thread_id"),
  syncedAt: timestampColumn("synced_at"),
});

export const calendarEvents = pgTable("calendar_events", {
  id: text("id").primaryKey(),
  actionId: text("action_id")
    .notNull()
    .references(() => proposedActions.id),
  providerEventId: text("provider_event_id").notNull(),
  startsAt: timestampColumn("starts_at"),
  endsAt: timestampColumn("ends_at"),
  syncedAt: timestampColumn("synced_at"),
});

export const policyRules = pgTable("policy_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  ruleType: text("rule_type").notNull(),
  value: text("value").notNull(),
  enabled: boolean("enabled").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

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
  (table) => ({
    targetLookupIdx: index("audit_logs_target_lookup_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export const workflowRuns = pgTable("workflow_runs", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .references(() => workItems.id),
  phase: text("phase").notNull(),
  status: text("status").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const workflowEvents = pgTable("workflow_events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  kind: text("kind").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: createdAtColumn(),
});

export const feedbackEntries = pgTable("feedback_entries", {
  id: text("id").primaryKey(),
  workItemId: text("work_item_id")
    .notNull()
    .unique()
    .references(() => workItems.id),
  rating: text("rating").notNull(),
  note: text("note"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
