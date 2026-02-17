# @nyte/workflows

## Purpose

Task orchestration boundary for Nyte decision queue operations.

## Responsibilities

- ingest signals and persist queue state
- approve/dismiss/feedback task entrypoints
- dispatch approved actions to PI extension runtime
- expose shared route contracts derived from task signatures
- emit structured orchestration logs with evlog
- model orchestration failures with typed Effect error channels

## Public exports

- task functions under `src/tasks/*`
- contracts from `src/contracts.ts`
- PI dispatch helper from `src/pi-dispatch.ts`

## Dependencies

- workspace: @nyte/application, @nyte/integrations, @nyte/pi-runtime

## Used by

- apps/web gateway routes

## Local commands

- `pnpm --filter @nyte/workflows typecheck`
