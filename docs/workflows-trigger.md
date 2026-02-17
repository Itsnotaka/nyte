# Workflows and Trigger boundary

## Current shape

- `packages/workflows` holds task entrypoints:
  - `ingestSignalsTask`
  - `approveActionTask`
  - `dismissActionTask`
  - `feedbackTask`
- `apps/web` routes call these tasks directly as the gateway boundary.
- Trigger task definitions live in `packages/workflows/src/trigger-tasks.ts`.
- Task IDs are centralized in `packages/workflows/src/task-ids.ts` and reused by Trigger task defs, runner wrappers, and API route logging.
- Workflow task lifecycle event names are centralized in `packages/workflows/src/workflow-log.ts` (`WORKFLOW_TASK_EVENTS`) and reused in orchestration logging.
- Task runner orchestration lives in `packages/workflows/src/trigger-runner.ts`.
  - Uses Effect runtime to model trigger/local fallback execution and typed failure conversion.
- Trigger task definitions include explicit retry policy and queue concurrency settings.
- Structured logs are emitted with `evlog` for task start/success/failure.
- Web Trigger runtime entrypoints:
  - config: `apps/web/trigger.config.ts`
  - task exports: `apps/web/trigger/workflows.ts`

## Trigger.dev integration boundary

The task functions are intentionally framework-agnostic and can be wrapped in Trigger.dev handlers without changing route contracts.

Recommended wrapping pattern:

1. Keep input/output types sourced from `packages/workflows/src/contracts.ts`.
2. Reuse runtime contract guards from the same module (`isWorkflowApiErrorResponse`, `isQueueSyncResponse`, `isApproveActionResponse`, `isDismissActionResponse`, `isFeedbackActionResponse`) in clients/gateways instead of redefining ad hoc payload checks.
3. Wrap each task in Trigger task definitions in an app-specific trigger runtime file.
4. Preserve idempotency key flow from approve requests to PI extension dispatch.
5. Keep retries at task-wrapper level; keep domain/application logic deterministic.
6. Keep Effect usage bounded to workflow orchestration only; do not spread into UI or schema modules.

## Logging model

- Workflow runner emits structured events:
  - `task.start`
  - `task.success`
  - `task.failure`
- Task events carry task-specific context:
  - action flows: `itemId` (approve/dismiss/feedback) and `rating` (feedback)
  - sync flow: cursor presence and watch keyword count
  - deterministic execution stage (`local` or `trigger`) computed once per orchestration run
  - stage typing is sourced from workflow error contracts and reused in web route log contexts
- Web API routes emit request-scoped wide logs using `createRequestLogger`.
- Log fields include: route/task identifiers, item IDs, user IDs, status, duration, typed error tags, plus sync-context (`hasCursor`, `watchKeywordCount`) when applicable.
- Queue sync route now stamps `workflow.ingest-signals` task ID across start/success/precondition-failure/error/final-emission logs for easier correlation with runner logs.
- Action routes (`approve`, `dismiss`, `feedback`) now stamp their workflow task IDs on start, validation failures, domain failures, and final emitted request logs for end-to-end trace consistency.
- Task-failure request logs use static event names (`*.task-error`) and carry human-readable error text in payload fields (instead of dynamic event names), preserving queryable log taxonomy.

## Failure model

- Route layer maps known domain errors (`ApprovalError`, `DismissError`, `FeedbackError`) to HTTP statuses.
- Task layer propagates unexpected errors for orchestration-level retry/alerting.
