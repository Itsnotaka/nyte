# PI Runtime

## Purpose

`packages/pi-runtime` defines tool extension contracts and handlers for provider-side execution.

## Available extensions

- `gmail.readThreadContext`
- `gmail.saveDraft`
- `calendar.createEvent`
- `calendar.updateEvent`

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

## Wiring

- Registry: `packages/pi-runtime/src/registry.ts`
- Executor: `packages/pi-runtime/src/execute-extension.ts`
- Workflow dispatch: `packages/workflows/src/pi-dispatch.ts`

PI is intentionally consumed only by the workflow layer.
