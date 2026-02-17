# Nyte

Nyte is a decision queue for high-impact Gmail and Google Calendar actions. It ingests signals, triages what needs human approval, and executes approved actions with a complete audit trail.

## What runs where

- `apps/web`: product UI and API gateway routes.
- `packages/workflows`: task orchestration for ingest/approve/dismiss/feedback.
- `packages/pi-runtime`: extension contracts and registry for Gmail/Calendar execution tools.
- `packages/db`: Drizzle Postgres schema, client, and migrations.
- `packages/application`: domain use-cases and persistence orchestration.
- `packages/integrations`: Gmail/Calendar ingestion adapters.
- `packages/domain`: pure triage/action/execution models.

## Data flow

1. Ingest: queue sync route polls Gmail + Calendar integrations.
2. Triage: domain gates score and filter decision-worthy items.
3. Decision queue: web UI renders pending items with proposed actions.
4. Approval: approve/dismiss routes call workflow tasks.
5. Execution: approved actions dispatch through PI extension contracts.
6. Audit: workflow and audit tables capture every state transition.

## Local setup

1. Install dependencies:
   - `pnpm install`
2. Configure env in `apps/web/.env.local`:
   - `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/nyte`
   - `BETTER_AUTH_SECRET=...`
   - Google OAuth variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
   - Trigger variables (`TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`) when using Trigger.dev runtime.
3. Apply database schema:
   - `pnpm db:push`
4. Typecheck:
   - `pnpm typecheck`
5. Trigger task dev runtime (optional):
   - `pnpm --filter web trigger:dev`

## Extend the system

### Add a PI extension

1. Add request/result contracts in `packages/pi-runtime/src/contracts.ts`.
2. Implement extension handler in `packages/pi-runtime/src/extensions/*`.
3. Register in `packages/pi-runtime/src/registry.ts`.
4. Dispatch from `packages/workflows/src/pi-dispatch.ts`.

### Add a workflow task

1. Create task in `packages/workflows/src/tasks`.
2. Derive exported request/response types in `packages/workflows/src/contracts.ts`.
3. Expose from `packages/workflows/src/index.ts`.
4. Wire in `apps/web/src/app/api/*` gateway route.

### Add a decision gate

1. Update gate logic in `packages/domain/src/triage.ts`.
2. Persist/consume gate evaluations through `packages/application/src/queue`.
3. Render impact in web queue UI if needed.

## Documentation

- `docs/architecture.md`
- `docs/database-postgres.md`
- `docs/workflows-trigger.md`
- `docs/pi-runtime.md`
- `docs/frontend-state.md`
- `apps/web/README.md`
