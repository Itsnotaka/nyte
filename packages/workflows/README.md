# @nyte/workflows

## Purpose

Task orchestration boundary for Nyte decision queue operations.

## Responsibilities

- ingest signals and persist queue state
- approve/dismiss/feedback task entrypoints
- dispatch approved actions to extension runtime
- expose shared route contracts derived from task signatures
- emit structured orchestration logs with evlog
- model orchestration failures with typed Effect error channels

## Public exports

- contracts from `src/contracts.ts`
- task runners from `src/trigger-runner.ts`
- Trigger.dev task definitions from `src/trigger-tasks.ts`

## Dependencies

- workspace: @nyte/application, @nyte/integrations, @nyte/extension-runtime

## Used by

- apps/web gateway routes

## Local commands

- `pnpm --filter @nyte/workflows typecheck`
