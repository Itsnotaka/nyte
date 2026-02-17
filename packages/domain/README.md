# @nyte/domain

## Purpose

Pure business logic for triage, action payloads, and deterministic execution modeling.

## Responsibilities

- Needs You gate evaluation and queue creation
- work-item/action payload typing (including shared proposed-action ID helper)
- deterministic execution snapshot model
- mock intake fixtures for local/dev flows

## Public exports

- main: src/index.ts
- subpaths: ./actions, ./execution, ./mock-intake, ./triage

## Dependencies

- no runtime deps

## Used by

- packages/application
- apps/web
- packages/integrations

## Local commands

- `pnpm --filter @nyte/domain typecheck`
