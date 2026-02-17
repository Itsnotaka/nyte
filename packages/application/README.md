# @nyte/application

## Purpose

Application/service layer for Nyte workflows. This package orchestrates use-cases across domain + db, without framework-specific UI code.

## Responsibilities

- queue persistence from intake signals
- approve/dismiss/feedback workflow transitions
- dashboard + metrics read models
- policy rules and workflow retention controls
- trust/audit/security posture reporting
- token/auth secret handling

## Package layout

- src/actions: approve, dismiss, feedback
- src/audit: audit log write/read utilities
- src/connections: Google connection state + secret rotation
- src/dashboard: dashboard and metrics read models
- src/policy: watch rules + workflow retention
- src/queue: signal/work-item persistence
- src/security: auth/runtime secret + token crypto + posture evaluation
- src/trust: trust report composition
- src/workflow: workflow run/event timeline logging
- src/shared: common helpers (time, payload parsing, default user)

## Public exports

Grouped-only API:

- `@nyte/application/actions`
- `@nyte/application/audit`
- `@nyte/application/connections`
- `@nyte/application/dashboard`
- `@nyte/application/policy`
- `@nyte/application/queue`
- `@nyte/application/security`
- `@nyte/application/trust`
- `@nyte/application/workflow`

## Dependencies

- workspace: @nyte/db, @nyte/domain
- external: neverthrow

## Used by

- apps/web
- packages/workflows

## Local commands

- `pnpm --filter @nyte/application typecheck`
