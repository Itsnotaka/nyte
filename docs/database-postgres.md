# Database (Postgres + Drizzle)

## Stack

- Driver: `pg` via `drizzle-orm/node-postgres`
- Schema: `packages/db/src/schema.ts` (`pgTable`)
- Config: `packages/db/drizzle.config.ts` (`dialect: "postgresql"`)
- Migration output: `packages/db/drizzle/*`

## Core tables

- auth: `users`, `accounts`, `sessions`, `verifications`
- queue: `work_items`, `proposed_actions`, `gate_evaluations`
- execution: `gmail_drafts`, `calendar_events`
- operations: `workflow_runs`, `workflow_events`, `audit_logs`, `feedback_entries`
- policy + connection: `policy_rules`, `connected_accounts`

## Commands

- Generate migration: `pnpm db:generate`
- Push schema: `pnpm db:push`
- Run migrations: `pnpm db:migrate`
- Studio: `pnpm db:studio`

## Environment

- `DATABASE_URL` should be a Postgres connection string.
- Default local fallback in code points to:
  - `postgres://postgres:postgres@127.0.0.1:5432/nyte`
