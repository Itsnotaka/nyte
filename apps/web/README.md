# web

## Purpose

Primary Nyte product surface: decision queue UI and thin API gateway.

## Responsibilities

- authentication/session handling
- shared auth provider constants for route/hook parity (e.g., Google provider id)
- queue sync and action mutation routes
- rendering and mutating decision queue state with TanStack Query + TanStack Form
- optional watch-keyword input in composer to bias ingestion matches
- Trigger.dev runtime config and exported task entrypoints
- request-scoped structured logging with evlog
- shared server helpers for session resolution and payload validation across routes
- shared validation covers object/string/enum parsing so route handlers stay thin
- shared field-level string parsers are used for item/access-token/idempotency extraction in route payloads
- shared field-level string parsers are generic over payload keys for stricter compile-time field access typing
- malformed JSON action requests are treated as invalid payloads (HTTP 400), not orchestration failures
- action routes share `parseRequestPayload` helper to combine safe JSON parsing + route-specific payload parser invocation
- action routes share a centralized auth-required error message for consistent 401 responses
- needs-you clients share a small HTTP utility for safe JSON parsing and workflow API error extraction
- same utility also centralizes standard JSON request/accept header constants and HTTP method constants for client calls
- unknown-object checks are centralized via shared value guards to avoid repeated unsafe casts
- needs-you API route paths are centralized in a shared constants module used by both route handlers and clients
- needs-you sync query parameter keys (`cursor`, `watch`) are centralized and shared by client and route parser
- API request event names are centralized in a shared server constants module to keep evlog event taxonomy stable
- route/method/task/event/message/status wiring for needs-you API handlers is centralized in a single server-side config module
- that config is constrained with explicit TypeScript `satisfies` typing for route/task/event/message/status completeness
- action routes reuse shared method/status templates in that config (`POST` + 400/401/404/409/422 + 200) to avoid drift
- queue sync route also reuses shared method/status templates in config (`GET` + 200/401/409/502)
- all routes now also source task-failure status (`502`) from config instead of hardcoding in error resolver callers
- route error resolver now requires explicit task-failure status input to enforce config-driven mapping
- request log context method typing is sourced from the same centralized needs-you method union
- request logger initialization also uses that centralized method value (not raw `request.method`)
- request log context route typing is sourced from centralized needs-you route path constants
- needs-you user-facing fallback/validation/auth/token-failure message strings are centralized and shared across routes, clients, and hook-level fallback rendering
- routes use shared workflow API error response helpers to keep error envelope creation + both direct/resolved JSON response construction consistent
- API routes and error resolvers share centralized HTTP status constants and `HttpStatusCode` union typing to avoid repeated magic numbers
- request-log context `status` field also uses shared `HttpStatusCode` typing
- action route payload parsing reuses shared `parseBodyWithItemId` helper so object + itemId validation semantics stay identical
- domain status mapping now uses explicit error codes from application actions (`not_found` vs conflict-like codes), not message parsing
- domain status resolver consumes exported centralized domain-status map typing from needs-you route config
- queue sync route returns the typed ingest-task output directly after contract validation (no response reshaping)
- action routes likewise return typed workflow task outputs directly (no local response aliasing)

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
