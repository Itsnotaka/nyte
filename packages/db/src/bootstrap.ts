import { sql } from "drizzle-orm";

import { db } from "./client";

let schemaReady: Promise<void> | null = null;

async function runBootstrap() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await db.run(sql`
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

  await db.run(sql`
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

  await db.run(sql`
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

  await db.run(sql`
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

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS gmail_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      action_id TEXT NOT NULL,
      provider_draft_id TEXT NOT NULL,
      thread_id TEXT,
      synced_at INTEGER NOT NULL,
      FOREIGN KEY(action_id) REFERENCES proposed_actions(id)
    )
  `);

  await db.run(sql`
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

  await db.run(sql`
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

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
    )
  `);
}

export async function ensureDbSchema() {
  if (!schemaReady) {
    schemaReady = runBootstrap();
  }

  await schemaReady;
}
