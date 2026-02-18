# Nyte

Nyte is a decision queue for high-impact Gmail and Google Calendar actions. It
ingests signals, scores approval gates, and executes approved actions with an
audit trail.

## What runs where

- `apps/web`: Next.js UI plus the tRPC gateway (`/api/trpc`).
- `packages/workflows`: orchestration for ingest/approve/dismiss/feedback.
- `packages/pi-runtime` (`@nyte/extension-runtime`): extension contracts and
  execution runtime for provider actions.
- `packages/application`: use-cases and persistence orchestration.
- `packages/domain`: pure triage/action/execution models.
- `packages/integrations`: Gmail/Calendar polling adapters.
- `packages/db`: Drizzle Postgres schema, client, and migrations.

## Data flow

1. `queue.sync` polls Gmail + Calendar integrations.
2. Domain triage evaluates approval gates and builds an approval queue.
3. Workspace UI renders pending items and proposed actions.
4. `actions.approve|dismiss|feedback` run workflow tasks.
5. Approved actions dispatch through extension runtime handlers.
6. Workflow and audit tables capture state transitions.

## Local setup

1. Install dependencies: `pnpm install`
2. Configure env in `apps/web/.env` or `apps/web/.env.local`
   - `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/nyte`
   - `BETTER_AUTH_SECRET=...`
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
   - Optional Trigger.dev vars: `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`
3. Apply schema: `pnpm db:push`
4. Validate: `pnpm typecheck && pnpm lint`
5. Optional Trigger.dev runtime: `pnpm --filter web trigger:dev`

## Extend the system

### Add an extension handler

1. Add request/result contracts in `packages/pi-runtime/src/contracts.ts`.
2. Implement handler in `packages/pi-runtime/src/extensions/*`.
3. Register handler in `packages/pi-runtime/src/registry.ts`.
4. Dispatch it from `packages/workflows/src/extension-dispatch.ts`.

### Add a workflow task

1. Add task logic in `packages/workflows/src/tasks`.
2. Derive API types in `packages/workflows/src/contracts.ts`.
3. Expose runner/trigger entrypoints in `packages/workflows/src`.
4. Wire usage in `apps/web/src/lib/server/router.ts`.

### Add an approval gate

1. Update gate logic in `packages/domain/src/triage.ts`.
2. Persist/consume evaluations in `packages/application/src/queue`.
3. Surface gate impact in workspace UI when needed.

## Documentation

- `docs/architecture.md`
- `docs/database-postgres.md`
- `docs/workflows-trigger.md`
- `docs/pi-runtime.md`
- `docs/frontend-state.md`
- `apps/web/README.md`
