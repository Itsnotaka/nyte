# Nyte security checklist (MVP)

This checklist documents current security controls and remaining hardening tasks for the supervisor MVP.

## Runtime + secrets

- [x] `BETTER_AUTH_SECRET` configured with production fallback guardrails in auth setup.
- [x] OAuth provider config is only enabled when required credentials are present.
- [x] Added token encryption helpers (`apps/web/lib/server/token-crypto.ts`) using AES-256-GCM with authenticated encryption.
- [x] Added tests for token encryption round-trip and tamper detection.
- [ ] Wire encrypted token storage into connected account persistence when OAuth token writes are enabled in runtime flows.

## Data minimization + PII handling

- [x] MVP stores only normalized work-item data needed for triage and action preparation.
- [x] Workflow timeline events store structured payloads (no raw mailbox bodies outside required summary/preview fields).
- [x] Feedback capture stores rating + optional note only.
- [ ] Add configurable retention policy for workflow event payloads.

## Execution safety

- [x] Approve action path has idempotent duplicate protection.
- [x] Dismiss action path has idempotent duplicate protection.
- [x] Duplicate side effects prevented for Gmail draft / Calendar event persistence through deterministic provider references and upsert behavior.
- [ ] Add explicit idempotency key propagation for future external provider calls.

## Auditability + trust

- [x] Workflow runs/events persisted for ingest, approve, dismiss, and feedback phases.
- [x] Processed item feedback captured and available for metrics.
- [x] Supervisor metrics exposed via API and surfaced in rules view.

## Operational follow-ups (post-MVP)

- [ ] Rotate and manage encryption keys via secrets manager.
- [ ] Add request-level authz checks for all action endpoints once multi-user session gating is enabled.
- [ ] Add rate limiting and abuse protections on mutable APIs.
