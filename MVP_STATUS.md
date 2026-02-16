# Nyte MVP Status

This document captures the **current shipped state** of the Nyte MVP in this repository.

## Product state

Nyte is implemented as a **design-first supervisor console**:

- Linear-style triage flow as the primary interface.
- Background agent processing prepares actions.
- Human stays in control through explicit approval gates.
- Email is **read + draft only** in v1 (no send automation).
- Google Calendar actions are approval-gated and execute on approval.

## Implemented core surfaces

- Supervisor shell with sections:
  - Needs You
  - Drafts
  - Processed
  - Connections
  - Rules
- Action detail drawer with structured action payload editing.
- Workflow timeline per item.
- Rules controls:
  - watch keywords,
  - workflow retention policy + prune action,
  - trust report snapshot,
  - recent audit log preview.

## Implemented backend capabilities

### Intake, triage, and execution

- Polling-based Gmail ingestion pipeline (`/api/sync/poll`).
- 5-gate Needs You engine:
  - Decision
  - Time
  - Relationship
  - Impact
  - Watch
- Prepared actions persisted for approval.
- Approval + dismissal APIs with idempotent behavior.
- Execution output persistence:
  - Gmail draft artifacts
  - Calendar event artifacts

### Persistence and observability

- Drizzle + SQLite data model with migrations.
- Workflow runs/events logging.
- Feedback capture and metrics aggregation.
- Persistent audit logging for sensitive mutations.
- Admin audit query API (`/api/admin/audit`).
- Admin trust report API (`/api/admin/trust`).

### Security and reliability hardening

- Session authorization enforcement for sensitive routes.
- In-memory rate limiting on mutable operations.
- Standardized 429 payload + `Retry-After` response header.
- AES-256-GCM token encryption with key rotation compatibility.
- Credential re-key endpoint for stored Google connection secrets.
- Proxy-applied security headers:
  - no-store for API responses,
  - CSP baseline,
  - frame/object hardening headers.
- Transactional DB writes for critical state transitions.

## API coverage (MVP)

- `POST /api/sync/poll`
- `GET /api/dashboard`
- `GET /api/metrics`
- `POST /api/actions/approve`
- `POST /api/actions/dismiss`
- `POST /api/feedback`
- `GET|POST|DELETE /api/policy-rules`
- `GET|POST|DELETE /api/connections/google`
- `POST /api/connections/google/rotate`
- `GET /api/workflows/[itemId]`
- `GET|POST /api/workflows/retention`
- `POST /api/workflows/prune`
- `GET /api/admin/trust`
- `GET /api/admin/audit`

## Quality status (latest)

All repository quality gates pass:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm --filter web test`
- `pnpm build`

## Explicit MVP constraints (still true)

- Polling-only ingestion.
- No autonomous email sending.
- Gmail + Google Calendar only.
- Human-in-the-loop approvals for externally impactful actions.
