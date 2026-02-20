# Scratchpad — Nyte Refactor

## Goal

- Move web API + data flow to tRPC + TanStack Query
- Flatten UI composition and delete one-line wrappers/re-exports
- Rename ambiguous/internal jargon (`needs-you`, `PI`) to explicit terms
- Keep contracts and runtime boundaries clear across
  domain/application/workflows

## Rename Map

| Old                                 | New                                 |
| ----------------------------------- | ----------------------------------- |
| `evaluateNeedsYou`                  | `evaluateApprovalGates`             |
| `createNeedsYouQueue`               | `createApprovalQueue`               |
| `needsYou` (payload field)          | `approvalQueue`                     |
| `loadNeedsYouQueue`                 | `loadApprovalQueue`                 |
| `DashboardNeedsYou`                 | `DashboardApprovalQueue`            |
| `lib/needs-you/*`                   | `lib/queue/*`                       |
| `NEEDS_YOU_MESSAGES`                | `QUEUE_MESSAGES`                    |
| `@nyte/pi-runtime`                  | `@nyte/extension-runtime`           |
| `PI_*` constants                    | `EXTENSION_*` constants             |
| `PiExtension*` types                | `Extension*` types                  |
| `executePiExtension`                | `executeExtension`                  |
| `piExtensionRegistry`               | `extensionRegistry`                 |
| `pi-dispatch.ts`                    | `extension-dispatch.ts`             |
| `dispatchApprovedActionToPi`        | `dispatchApprovedActionToExtension` |
| `piExtension` (approve task result) | `extensionResult`                   |

## Files Changed (current refactor wave)

### apps/web

| File                                       | Change                                                          |
| ------------------------------------------ | --------------------------------------------------------------- |
| `apps/web/src/components/action-card.tsx`  | import path renamed to `~/lib/queue/presenters`                 |
| `apps/web/src/components/workspace.tsx`    | `NEEDS_YOU_MESSAGES` → `QUEUE_MESSAGES`, new queue path         |
| `apps/web/src/hooks/use-workspace.ts`      | `needsYou` → `approvalQueue`; message imports/constants renamed |
| `apps/web/src/lib/needs-you/messages.ts`   | deleted                                                         |
| `apps/web/src/lib/needs-you/presenters.ts` | deleted                                                         |
| `apps/web/src/lib/queue/messages.ts`       | new                                                             |
| `apps/web/src/lib/queue/presenters.ts`     | new                                                             |

### packages/domain

| File                            | Change                                           |
| ------------------------------- | ------------------------------------------------ |
| `packages/domain/src/triage.ts` | approval-gate and approval-queue naming refactor |

### packages/application

| File                                              | Change                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/application/src/queue/queue-store.ts`   | `evaluateApprovalGates` usage                                                 |
| `packages/application/src/dashboard/dashboard.ts` | `needsYou`/`loadNeedsYouQueue` renamed to `approvalQueue`/`loadApprovalQueue` |

### packages/workflows

| File                                                  | Change                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `packages/workflows/src/tasks/ingest-signals-task.ts` | `needsYou` result field renamed to `approvalQueue`              |
| `packages/workflows/src/contracts.ts`                 | queue response key updated; extension result type guard renamed |
| `packages/workflows/src/tasks/approve-action-task.ts` | extension dispatch function + result field renamed              |
| `packages/workflows/src/workflow-runner.ts`           | explicit return types to avoid inferred private type leakage    |
| `packages/workflows/src/pi-dispatch.ts`               | deleted (renamed)                                               |
| `packages/workflows/src/extension-dispatch.ts`        | new dispatch module name + extension runtime names              |
| `packages/workflows/src/index.ts`                     | public API surface tightened                                    |
| `packages/workflows/package.json`                     | dependency `@nyte/extension-runtime`                            |

### packages/pi-runtime (package renamed, path kept)

| File                                             | Change                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `packages/pi-runtime/package.json`               | package name changed to `@nyte/extension-runtime`                  |
| `packages/pi-runtime/src/contracts.ts`           | `PI_*` and `Pi*` symbols renamed to explicit extension terminology |
| `packages/pi-runtime/src/execute-extension.ts`   | `executeExtension` + new symbol names                              |
| `packages/pi-runtime/src/registry.ts`            | `extensionRegistry` naming                                         |
| `packages/pi-runtime/src/extensions/gmail.ts`    | `EXTENSION_NAMES` usage                                            |
| `packages/pi-runtime/src/extensions/calendar.ts` | `EXTENSION_NAMES` usage                                            |
| `packages/pi-runtime/src/index.ts`               | dropped `registry` from public exports                             |

### Workspace metadata

| File             | Change                                                  |
| ---------------- | ------------------------------------------------------- |
| `pnpm-lock.yaml` | workspace dependency graph updated after package rename |

## Plan — Gmail Reader Page (learn from Mail-0/Zero)

## Target outcome

- Signed-in user can open a dedicated mail page, browse inbox threads, open a
  thread, and read message content.
- Keep existing approval-queue flow intact; mail reader is additive.
- Reuse current Google auth/token flow; no duplicate auth system.

## Principles borrowed from Zero

- Use Gmail incremental sync via `historyId` (baseline once, then deltas).
- Keep sync idempotent (upsert by `threadId`/`messageId`), resilient to retries.
- Treat rate-limit and quota errors as first-class (retry/backoff path).
- Keep webhook/watch setup as separate concern from UI read path.

## Delivery phases

### Phase 1 — Ship usable read page (MVP)

1. Add server contracts for mailbox read APIs (thread list + thread detail).
2. Add Gmail integration read helpers for:
   - listing inbox threads
   - loading full thread payload
   - extracting safe display fields (`from`, `subject`, `date`, `snippet`,
     `body`).
3. Add tRPC mail router methods:
   - `mail.listThreads`
   - `mail.getThread`
   - `mail.refresh` (manual pull)
4. Build `/mail` page with split layout:
   - left: thread list
   - right: selected thread reader
5. Add loading, empty, reconnect-required, and API-failure states.

### Phase 2 — Zero-style incremental sync

1. Add mailbox sync state persistence (per user): last processed `historyId`,
   last sync time.
2. Baseline sync on first load; afterwards fetch only Gmail history deltas.
3. Upsert changed threads/messages into local cache tables.
4. UI `mail.refresh` uses delta sync path, not full reload.
5. Add fallback behavior when history window is invalid/expired (re-baseline).

### Phase 3 — Push/watch hardening (optional after MVP)

1. Add Gmail watch bootstrap + renewal lifecycle.
2. Add notify endpoint to accept Gmail push events and queue mailbox delta sync.
3. Add lock/lease per connection to prevent concurrent duplicate delta
   processors.
4. Add observability counters (sync duration, changed threads count, failure
   reasons).

## Proposed file-by-file implementation

### `packages/integrations`

- Add `packages/integrations/src/gmail/mailbox.ts`:
  - `listInboxThreads(...)`
  - `getThreadById(...)`
  - `listHistoryDelta(...)`
  - payload parsing utilities for headers/body extraction.

### `packages/application`

- Add `packages/application/src/mail/mailbox-sync.ts`:
  - baseline sync and delta sync orchestration.
  - idempotent upsert mapping from Gmail payload to app model.
- Add `packages/application/src/mail/mailbox-read.ts`:
  - query helpers for list/detail response shape consumed by UI.

### `packages/db`

- Add schema tables (names TBD) for:
  - mailbox sync state (`user_id`, `history_id`, `synced_at`)
  - thread cache (`thread_id`, summary/sender/snippet/date, labels)
  - message cache (`message_id`, thread_id, sender, body preview/body html/text,
    received_at)
- Add indexes for list sort (`received_at desc`) and thread lookup.

### `apps/web`

- Extend `apps/web/src/lib/server/router.ts` with `mail` router section.
- Add hook `apps/web/src/hooks/use-mail-reader.ts`.
- Add UI components:
  - `apps/web/src/components/mail-thread-list.tsx`
  - `apps/web/src/components/mail-thread-reader.tsx`
  - `apps/web/src/components/mail-reader-workspace.tsx`
- Add route: `apps/web/src/app/mail/page.tsx`.
- Add navigation entry from current workspace root (queue <-> mail).

### `packages/workflows` / `packages/pi-runtime`

- Keep `gmail.readThreadContext` extension aligned with same parsing model used
  by reader page.
- If needed, route thread-context reads through shared mailbox read service to
  avoid logic drift.

## API contract sketch (for tRPC)

- `mail.listThreads(input: { cursor?: string; limit?: number; query?: string })`
  - returns
    `{ threads: MailThreadListItem[]; nextCursor?: string; lastSyncedAt: string }`
- `mail.getThread(input: { threadId: string })`
  - returns `{ thread: MailThreadDetail }`
- `mail.refresh(input: { cursor?: string })`
  - returns
    `{ changedThreadIds: string[]; nextCursor?: string; lastSyncedAt: string }`

## Validation plan

- Unit tests for Gmail payload/header/body parsing edge-cases.
- Unit tests for history delta merge/upsert behavior.
- tRPC integration tests for `mail.listThreads` + `mail.getThread` auth/error
  paths.
- Repo checks before merge:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm fmt`

## Rollout plan

1. Land Phase 1 behind feature flag (`mail_reader_enabled`).
2. Internal dogfood on connected Google accounts.
3. Land Phase 2 delta sync; compare API call count and latency vs baseline.
4. Enable by default, keep watch/push in Phase 3 follow-up.

## Unresolved questions

- Route UX: separate `/mail` page, or tab inside existing queue workspace?
- Read scope: inbox-only for v1, or inbox/sent/archive filters at launch?
- Body rendering: plain text only first, or sanitized HTML support in v1?
- Attachments: metadata only in v1, or download/open flow now?
- Do we persist full message bodies locally, or fetch thread detail on-demand
  only?

## Product Narrative — what Nyte is (end-to-end)

Nyte is a personal decision/work queue app:

1. User connects Google once (OAuth with Gmail + Calendar scopes).
2. Background ingestion pulls Gmail + Calendar changes incrementally
   (`historyId`/`syncToken`) and converts them to normalized work items.
3. Application layer scores urgency/impact and prepares proposed actions (draft
   reply, schedule event, refund queue, etc.).
4. UI shows a prioritized queue; user can edit, approve, or dismiss.
5. Workflows execute approved actions through extension runtime and persist
   logs/state.
6. Next sync continues from stored cursors, so polling stays incremental and
   cheap.

In short: **Nyte turns inbound signals into daily decisions + actions**.

## Expected Product Flow — Linear-like daily todo app (input-first)

Target UX: one focused surface like Linear, but centered on daily tasks.

### Core interaction loop

1. User lands on one screen.
2. Primary element is a single input/command bar.
3. User types plain commands/tasks (create/update/filter/complete).
4. List updates instantly below input (Today, Upcoming, Done).
5. Enter executes; keyboard navigation is first-class.
6. Background sync quietly injects new tasks from Gmail/Calendar.
7. User resolves tasks fast, mostly without opening heavy cards/modals.

### Input examples

- `follow up with Acme tomorrow 9am`
- `watch refund, contract`
- `done call Sarah`
- `schedule prep for board meeting Friday`

## UI simplification direction (delete most components)

### Keep

- App shell
- Single command input component
- Compact task list rows
- Minimal status chips (`today`, `overdue`, `blocked`, `done`)

### Remove/replace

- Large card-heavy workspace composition
- Secondary metric/health panels
- Most per-item inline editors in list rows
- Redundant wrappers that only pass props

### New visual principles

- Dense, keyboard-first, low chrome
- One main column (optional right detail pane later)
- Fast capture + fast completion over rich per-card editing

## Proposed flow mapping to current architecture

- **Integrations/Workflows stay mostly as-is** (already incremental +
  resilient).
- **Domain/Application stay as task engine** (intent, scoring, gating).
- **Biggest rewrite is web UI composition**: move from workspace/cards to
  input + list model.
- **tRPC + TanStack Query remain transport/state layer**.

## UI rewrite plan (concise)

1. Replace current queue workspace route with input-first todo layout.
2. Introduce command parser contract (client-side parse hints + server action).
3. Render normalized `WorkItemWithAction` as compact rows.
4. Add keyboard actions: create, complete, snooze, open details.
5. Keep Gmail/Calendar sync in background; surface as low-noise badges.
6. Remove obsolete components after parity.

## Unresolved questions for this direction

- Should one input support both freeform todos and slash commands?
- Are Gmail/Calendar generated items mixed with manual todos in one list, or
  separated by filter?
- Do we want optimistic local-only todo creation before server roundtrip?
- Is detail view inline expand, side panel, or full page?
