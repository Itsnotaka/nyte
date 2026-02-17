# Frontend state model

## Principles

- Server state: TanStack Query
- Form state: TanStack Form
- Avoid effect-driven derived state when values can be computed during render

## Current usage

- Query key scoped by authenticated user id (`needs-you-sync`).
- Sync cursor is sourced from cached query payload, not effect-managed refs.
- Composer input is interpreted as optional watch keywords and sent to sync route as query params.
- Client command parsing and sync-route query parsing share the same watch-keyword normalization helper to keep behavior consistent.
- Sync client applies the same normalization at network boundary as a defensive guard for any future call sites.
- Sync route normalizes, deduplicates, and caps watch keywords before ingestion dispatch.
- Active watch keywords are surfaced in workspace UI after each sync for operator clarity.
- Approve/dismiss actions use TanStack Query mutations and query invalidation.
- Action API client uses a shared POST helper + safe JSON parsing for consistent error handling across approve/dismiss/feedback.
- Action API client also validates that successful responses are object payloads before casting to contract types.
- Action and sync clients now validate successful payloads using runtime guards exported from `@nyte/workflows/contracts`.
- Action success notices + fallback mutation error text are sourced from shared needs-you message constants.
- Disconnected workspace empty-state prompt also reuses shared queue auth message constant.
- Connected-empty workspace prompt (`no action cards`) also uses shared needs-you message constants.
- Sync filtered notice prefix + disconnect notice also come from shared needs-you message constants.
- Composer input uses TanStack Form field state.
- API routes use request-scoped evlog logging helpers for structured operation traces.
- Workflow route error handling is centralized in a shared server helper for consistent 502 mapping.

## Route contracts

- Queue sync: `QueueSyncResponse`
- Approve: `ApproveActionRequest` / `ApproveActionResponse`
- Dismiss: `DismissActionRequest` / `DismissActionResponse`
- Feedback: `FeedbackActionRequest` / `FeedbackActionResponse`

These contracts are imported from `@nyte/workflows` and reused directly in route handlers and clients.
Queue request field typing (cursor/watch keywords) is also sourced from workflow contracts in sync client + workspace hook state.
Cursor propagation now uses contract-native optional semantics (undefined when absent) instead of introducing client-local `null` variants.
