# Workflows and Trigger boundary

## Current shape

- `packages/workflows` holds task entrypoints:
  - `ingestSignalsTask`
  - `approveActionTask`
  - `dismissActionTask`
  - `feedbackTask`
- `apps/web` routes call these tasks directly as the gateway boundary.
- Trigger task definitions live in `packages/workflows/src/trigger-tasks.ts`.
- Web Trigger runtime entrypoints:
  - config: `apps/web/trigger.config.ts`
  - task exports: `apps/web/trigger/workflows.ts`

## Trigger.dev integration boundary

The task functions are intentionally framework-agnostic and can be wrapped in Trigger.dev handlers without changing route contracts.

Recommended wrapping pattern:

1. Keep input/output types sourced from `packages/workflows/src/contracts.ts`.
2. Wrap each task in Trigger task definitions in an app-specific trigger runtime file.
3. Preserve idempotency key flow from approve requests to PI extension dispatch.
4. Keep retries at task-wrapper level; keep domain/application logic deterministic.

## Failure model

- Route layer maps known domain errors (`ApprovalError`, `DismissError`, `FeedbackError`) to HTTP statuses.
- Task layer propagates unexpected errors for orchestration-level retry/alerting.
