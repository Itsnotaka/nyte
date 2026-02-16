import { sql } from "drizzle-orm";

import { db } from "./client";

let schemaReady: Promise<void> | null = null;

async function runStatement(statement: string) {
  await db.run(sql.raw(statement));
}

async function runStatementIgnoringDuplicateColumn(statement: string) {
  try {
    await runStatement(statement);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("duplicate column name")) {
      return;
    }

    throw error;
  }
}

async function runBootstrap() {
  await db.run(sql`PRAGMA busy_timeout = 5000`);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await runStatementIgnoringDuplicateColumn(`
    ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0
  `);

  await runStatementIgnoringDuplicateColumn(`
    ALTER TABLE users ADD COLUMN image TEXT
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await runStatement(`
    CREATE INDEX IF NOT EXISTS accounts_user_id_idx
    ON accounts (user_id)
  `);

  await runStatement(`
    CREATE INDEX IF NOT EXISTS accounts_provider_account_idx
    ON accounts (provider_id, account_id)
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await runStatement(`
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx
    ON sessions (user_id)
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY NOT NULL,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await runStatement(`
    CREATE INDEX IF NOT EXISTS verifications_identifier_idx
    ON verifications (identifier)
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      scopes TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      connected_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      source TEXT NOT NULL,
      actor TEXT NOT NULL,
      summary TEXT NOT NULL,
      context TEXT NOT NULL,
      preview TEXT NOT NULL,
      status TEXT NOT NULL,
      priority_score INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS gate_evaluations (
      id TEXT PRIMARY KEY NOT NULL,
      work_item_id TEXT NOT NULL,
      gate TEXT NOT NULL,
      matched INTEGER NOT NULL,
      reason TEXT NOT NULL,
      score INTEGER NOT NULL,
      FOREIGN KEY(work_item_id) REFERENCES work_items(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS proposed_actions (
      id TEXT PRIMARY KEY NOT NULL,
      work_item_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(work_item_id) REFERENCES work_items(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS gmail_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      action_id TEXT NOT NULL,
      provider_draft_id TEXT NOT NULL,
      thread_id TEXT,
      synced_at INTEGER NOT NULL,
      FOREIGN KEY(action_id) REFERENCES proposed_actions(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY NOT NULL,
      action_id TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      synced_at INTEGER NOT NULL,
      FOREIGN KEY(action_id) REFERENCES proposed_actions(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY NOT NULL,
      work_item_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(work_item_id) REFERENCES work_items(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS policy_rules (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      value TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await runStatement(`
    CREATE INDEX IF NOT EXISTS audit_logs_target_lookup_idx
    ON audit_logs (target_type, target_id, created_at)
  `);

  await runStatement(`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON audit_logs (created_at)
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
    )
  `);

  await runStatement(`
    CREATE TABLE IF NOT EXISTS feedback_entries (
      id TEXT PRIMARY KEY NOT NULL,
      work_item_id TEXT NOT NULL UNIQUE,
      rating TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(work_item_id) REFERENCES work_items(id)
    )
  `);
}

export async function ensureDbSchema() {
  if (!schemaReady) {
    schemaReady = runBootstrap();
  }

  await schemaReady;
}
