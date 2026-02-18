# Scratchpad — Nyte Refactor

## Goal
- Move web API + data flow to tRPC + TanStack Query
- Flatten UI composition and delete one-line wrappers/re-exports
- Rename ambiguous/internal jargon (`needs-you`, `PI`) to explicit terms
- Keep contracts and runtime boundaries clear across domain/application/workflows

## Rename Map

| Old | New |
|-----|-----|
| `evaluateNeedsYou` | `evaluateApprovalGates` |
| `createNeedsYouQueue` | `createApprovalQueue` |
| `needsYou` (payload field) | `approvalQueue` |
| `loadNeedsYouQueue` | `loadApprovalQueue` |
| `DashboardNeedsYou` | `DashboardApprovalQueue` |
| `lib/needs-you/*` | `lib/queue/*` |
| `NEEDS_YOU_MESSAGES` | `QUEUE_MESSAGES` |
| `@nyte/pi-runtime` | `@nyte/extension-runtime` |
| `PI_*` constants | `EXTENSION_*` constants |
| `PiExtension*` types | `Extension*` types |
| `executePiExtension` | `executeExtension` |
| `piExtensionRegistry` | `extensionRegistry` |
| `pi-dispatch.ts` | `extension-dispatch.ts` |
| `dispatchApprovedActionToPi` | `dispatchApprovedActionToExtension` |
| `piExtension` (approve task result) | `extensionResult` |

## Files Changed (current refactor wave)

### apps/web

| File | Change |
|------|--------|
| `apps/web/src/components/action-card.tsx` | import path renamed to `~/lib/queue/presenters` |
| `apps/web/src/components/workspace.tsx` | `NEEDS_YOU_MESSAGES` → `QUEUE_MESSAGES`, new queue path |
| `apps/web/src/hooks/use-workspace.ts` | `needsYou` → `approvalQueue`; message imports/constants renamed |
| `apps/web/src/lib/needs-you/messages.ts` | deleted |
| `apps/web/src/lib/needs-you/presenters.ts` | deleted |
| `apps/web/src/lib/queue/messages.ts` | new |
| `apps/web/src/lib/queue/presenters.ts` | new |

### packages/domain

| File | Change |
|------|--------|
| `packages/domain/src/triage.ts` | approval-gate and approval-queue naming refactor |

### packages/application

| File | Change |
|------|--------|
| `packages/application/src/queue/queue-store.ts` | `evaluateApprovalGates` usage |
| `packages/application/src/dashboard/dashboard.ts` | `needsYou`/`loadNeedsYouQueue` renamed to `approvalQueue`/`loadApprovalQueue` |

### packages/workflows

| File | Change |
|------|--------|
| `packages/workflows/src/tasks/ingest-signals-task.ts` | `needsYou` result field renamed to `approvalQueue` |
| `packages/workflows/src/contracts.ts` | queue response key updated; extension result type guard renamed |
| `packages/workflows/src/tasks/approve-action-task.ts` | extension dispatch function + result field renamed |
| `packages/workflows/src/trigger-runner.ts` | explicit return types to avoid inferred private type leakage |
| `packages/workflows/src/pi-dispatch.ts` | deleted (renamed) |
| `packages/workflows/src/extension-dispatch.ts` | new dispatch module name + extension runtime names |
| `packages/workflows/src/index.ts` | public API surface tightened |
| `packages/workflows/package.json` | dependency `@nyte/extension-runtime` |

### packages/pi-runtime (package renamed, path kept)

| File | Change |
|------|--------|
| `packages/pi-runtime/package.json` | package name changed to `@nyte/extension-runtime` |
| `packages/pi-runtime/src/contracts.ts` | `PI_*` and `Pi*` symbols renamed to explicit extension terminology |
| `packages/pi-runtime/src/execute-extension.ts` | `executeExtension` + new symbol names |
| `packages/pi-runtime/src/registry.ts` | `extensionRegistry` naming |
| `packages/pi-runtime/src/extensions/gmail.ts` | `EXTENSION_NAMES` usage |
| `packages/pi-runtime/src/extensions/calendar.ts` | `EXTENSION_NAMES` usage |
| `packages/pi-runtime/src/index.ts` | dropped `registry` from public exports |

### Workspace metadata

| File | Change |
|------|--------|
| `pnpm-lock.yaml` | workspace dependency graph updated after package rename |
