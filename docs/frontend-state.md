# Frontend state model

## Principles

- Server state: TanStack Query
- Form state: TanStack Form
- Avoid effect-driven derived state when values can be computed during render

## Current usage

- Query key scoped by authenticated user id (`needs-you-sync`).
- Sync cursor is sourced from cached query payload, not effect-managed refs.
- Composer input is interpreted as optional watch keywords and sent to sync route as query params.
- Approve/dismiss actions use TanStack Query mutations and query invalidation.
- Composer input uses TanStack Form field state.
- API routes use request-scoped evlog logging helpers for structured operation traces.
- Workflow route error handling is centralized in a shared server helper for consistent 502 mapping.

## Route contracts

- Queue sync: `QueueSyncResponse`
- Approve: `ApproveActionRequest` / `ApproveActionResponse`
- Dismiss: `DismissActionRequest` / `DismissActionResponse`
- Feedback: `FeedbackActionRequest` / `FeedbackActionResponse`

These contracts are imported from `@nyte/workflows` and reused directly in route handlers and clients.
