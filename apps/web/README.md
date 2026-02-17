# web

## Purpose

Primary Nyte product surface: decision queue UI and thin API gateway.

## Responsibilities

- authentication/session handling
- queue sync and action mutation routes
- rendering and mutating decision queue state with TanStack Query + TanStack Form
- optional watch-keyword input in composer to bias ingestion matches
- Trigger.dev runtime config and exported task entrypoints
- request-scoped structured logging with evlog
- shared server helpers for session resolution and payload validation across routes
- shared validation covers object/string/enum parsing so route handlers stay thin
- malformed JSON action requests are treated as invalid payloads (HTTP 400), not orchestration failures
- action routes share a centralized auth-required error message for consistent 401 responses

## API routes

- `GET /api/queue/sync`
- `POST /api/actions/approve`
- `POST /api/actions/dismiss`
- `POST /api/actions/feedback`

## Trigger files

- `trigger.config.ts`
- `trigger/workflows.ts`

## Local commands

- `pnpm --filter web typecheck`
- `pnpm --filter web trigger:dev`
