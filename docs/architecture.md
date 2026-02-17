# Architecture

## Product goal

Nyte reduces operator interruption by escalating only decision-critical
email/calendar actions into one queue.

## Runtime planes

- UI + gateway: `apps/web`
- Task orchestration: `packages/workflows`
- Extension execution: `packages/pi-runtime`
- Use-case layer: `packages/application`
- DB layer: `packages/db`
- Ingestion adapters: `packages/integrations`
- Domain model: `packages/domain`

## Ownership map

- Queue scoring and action payloads: `packages/domain`
- Writes to work items/actions/audit/workflow tables: `packages/application`
- Provider polling and normalization: `packages/integrations`
- Route-level auth/session + HTTP translation: `apps/web`
- Extension contracts + tool handlers: `packages/pi-runtime`
- Task-level composition and handoff boundaries: `packages/workflows`
  - orchestration runtime semantics in workflows use bounded Effect programs
- Observability:
  - `evlog` structured logging in API gateway routes and workflow orchestration

## Decision queue flow

1. `GET /api/queue/sync`
2. workflows ingest task pulls Gmail/Calendar signals
3. application queue persistence stores work items + proposed actions
4. UI reads pending queue and renders cards
5. operator approves/dismisses
6. action tasks update state and execute PI extension when applicable
7. audit/workflow logs capture execution and traceability
