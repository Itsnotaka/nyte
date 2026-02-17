# PI Runtime

## Purpose

`packages/pi-runtime` defines tool extension contracts and handlers for provider-side execution.

## Available extensions

- `gmail.readThreadContext`
- `gmail.saveDraft`
- `calendar.createEvent`
- `calendar.updateEvent`

Canonical extension name constants:

- `PI_EXTENSION_NAMES` exported from `packages/pi-runtime/src/contracts.ts`
- `PI_AUDIT_SOURCES` exported from `packages/pi-runtime/src/contracts.ts`
- `PI_AUTH_PROVIDERS` exported from `packages/pi-runtime/src/contracts.ts`

## Contract model

Each request carries:

- `name`: extension name
- `auth`: provider/user scope
- `idempotencyKey`: deterministic operation key
- `audit`: work item and action metadata
- `input`: extension-specific payload

Each result returns:

- `status: "executed"`
- `idempotencyKey`
- `output`
- `executedAt`

Runtime guard helper:

- `isPiExtensionResult` for downstream consumers that validate PI execution envelopes at runtime.
- `isPiExtensionName` for validating extension-name strings at runtime.

## Wiring

- Registry: `packages/pi-runtime/src/registry.ts`
- Executor: `packages/pi-runtime/src/execute-extension.ts`
- Workflow dispatch: `packages/workflows/src/pi-dispatch.ts`

Executor uses overload-based dispatch per extension request type to keep request/result typing precise without unsafe request casts.

PI is intentionally consumed only by the workflow layer.

## Safe extension checklist

When adding a new extension:

1. Validate input shape with explicit contract types.
2. Require idempotency key on every mutating operation.
3. Include audit metadata (`workItemId`, `actionId`, source).
4. Restrict scopes to least privilege for the provider call.
5. Keep secrets and tokens out of logs and returned payloads.
