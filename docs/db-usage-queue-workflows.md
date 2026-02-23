# Queue, Ingestion State, and Workflow DB Usage

How `queue-store`, `ingestion-state`, and workflow-related code use `@nyte/db`
and their transactional/real-time requirements.

## DB Package

- **Client**: `@nyte/db/client` exports `db` (Drizzle + Neon serverless pool).
- **Schema**: `@nyte/db/schema` exports tables: `workItems`, `gateEvaluations`,
  `proposedActions`, `ingestionState`, `workflowRuns`, `workflowEvents`,
  `auditLogs`, `gmailDrafts`, `calendarEvents`, `feedbackEntries`.

---

## 1. Queue Store (`persistSignals`)

**File**:
[packages/application/src/queue/queue-store.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/queue/queue-store.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; `gateEvaluations`, `proposedActions`,
  `workItems` from `@nyte/db/schema`.
- Single transaction per signal in `upsertWorkItem` (L178–301).

**Operations in transaction**:

1. `workItems` upsert (insert + onConflictDoUpdate)
2. `gateEvaluations` delete + insert
3. `proposedActions` delete + insert
4. `recordWorkItemRun` (workflowRuns + workflowEvents) via `executor: tx`
5. `recordAuditLog` via `executor: tx`

**Transactional requirements**:

- All-or-nothing per work item: work item, gates, proposed action, run log, and
  audit log must commit together.
- Uses `db.transaction(async (tx) => {...})` and passes `tx` to
  `recordWorkItemRun` and `recordAuditLog`.

**Real-time requirements**:

- None. Batch ingestion; feed is refreshed on app open (stale-gated) and via
  cron.

---

## 2. Ingestion State

**File**:
[packages/application/src/queue/ingestion-state.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/queue/ingestion-state.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; `ingestionState` from `@nyte/db/schema`.
- `getUserIngestionState`:
  `db.select().from(ingestionState).where(eq(...)).limit(1)`.
- `upsertUserIngestionState`:
  `executor.insert(ingestionState).values(...).onConflictDoUpdate(...)`.

**Executor pattern**:

- `upsertUserIngestionState` accepts optional
  `executor?: IngestionStateExecutor` (Pick<typeof db, "insert">).
- Default `executor = db`; can be passed a transaction client for participation
  in a larger transaction.

**Transactional requirements**:

- No explicit transaction in this module.
- Used from `ingestSignalsTask` in two places:
  1. On error: `upsertUserIngestionState` with `lastError` (standalone).
  2. On success: `upsertUserIngestionState` after `persistSignals` (standalone).
- Ingestion state is updated outside the `persistSignals` transaction; no
  atomicity with work item persistence.

**Real-time requirements**:

- None. Cursors are read/written for incremental sync; no live subscriptions.

---

## 3. Workflow-Related DB Operations

### 3.1 Run Log (`recordWorkItemRun`, `listWorkItemRunTimeline`, `pruneWorkflowEvents`)

**File**:
[packages/application/src/run-log.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/run-log.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; `workflowRuns`, `workflowEvents` from
  `@nyte/db/schema`.
- `recordWorkItemRun`: `executor.insert(workflowRuns)` then
  `executor.insert(workflowEvents)`.
- `listWorkItemRunTimeline`: `db.select().from(workflowRuns)` +
  `db.select().from(workflowEvents)`.
- `pruneWorkflowEvents`: select old runs, delete events, delete runs (no
  transaction).

**Executor pattern**:

- `recordWorkItemRun` accepts `executor?: Pick<typeof db, "insert">`; used with
  `tx` inside `queue-store` and `approve-action` transactions.

**Transactional requirements**:

- When called from `queue-store` or `approve-action`, run log writes are part of
  the parent transaction.
- `pruneWorkflowEvents` uses multiple statements without a transaction; possible
  inconsistency if interrupted between delete events and delete runs.

**Real-time requirements**:

- None. Timeline is read on demand; no subscriptions.

---

### 3.2 Approve Action

**File**:
[packages/application/src/actions/approve-action.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/actions/approve-action.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; `calendarEvents`, `gmailDrafts`,
  `proposedActions`, `workItems` from `@nyte/db/schema`.
- Reads: `workItems`, `proposedActions`; optional reads from `gmailDrafts`,
  `calendarEvents` for idempotent resolution.
- Single transaction (L242–347) for non-idempotent path:
  1. `proposedActions` update (status = executed)
  2. `gmailDrafts` or `calendarEvents` insert/upsert
  3. `workItems` update (status = completed)
  4. `recordWorkItemRun` via `executor: tx`
  5. `recordAuditLog` via `executor: tx`

**Transactional requirements**:

- All approval writes must commit atomically; uses
  `db.transaction(async (tx) => {...})`.

**Real-time requirements**:

- None. Approval is user-triggered; no live updates.

---

### 3.3 Queue Tool Call (manual command queueing)

**File**:
[packages/application/src/queue/queue-tool-call.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/queue/queue-tool-call.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; `proposedActions`, `workItems` from
  `@nyte/db/schema`.
- Single transaction (L64–92): insert `workItems`, insert `proposedActions`.

**Transactional requirements**:

- Both inserts must commit together; uses `db.transaction`.

**Real-time requirements**:

- None.

---

### 3.4 Ingest Signals Task (workflow orchestration)

**File**:
[packages/workflows/src/tasks/ingest-signals-task.ts](file:///Users/workgyver/Developer/nyte/packages/workflows/src/tasks/ingest-signals-task.ts)

**DB usage**:

- No direct db imports. Uses:
  - `getUserIngestionState` (ingestion-state)
  - `upsertUserIngestionState` (ingestion-state)
  - `persistSignals` (queue-store)
  - `getDashboardData` (dashboard)

**Transactional requirements**:

- No single transaction across the flow. Sequence:
  1. Read ingestion state
  2. Ingest Gmail + Calendar (external APIs)
  3. `persistSignals` (per-signal transactions)
  4. `upsertUserIngestionState` (standalone)
- If `upsertUserIngestionState` fails after `persistSignals`, cursors are not
  updated; next run may re-ingest some signals (acceptable).

**Real-time requirements**:

- None. Triggered by app open (stale-gated) or cron every 5 minutes.

---

### 3.5 Audit Log

**File**:
[packages/application/src/audit/audit-log.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/audit/audit-log.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; `auditLogs` from `@nyte/db/schema`.
- `recordAuditLog`: `executor.insert(auditLogs)`; accepts `executor` for
  transaction participation.
- Read operations: `listAuditLogs`, `listAuditLogsByTarget`, `countAuditLogs`,
  etc. use `db` directly.

**Transactional requirements**:

- When called from `queue-store` or `approve-action`, audit writes run inside
  the parent transaction.

---

### 3.6 Dashboard

**File**:
[packages/application/src/dashboard/dashboard.ts](file:///Users/workgyver/Developer/nyte/packages/application/src/dashboard/dashboard.ts)

**DB usage**:

- Imports: `db` from `@nyte/db/client`; multiple tables from `@nyte/db/schema`.
- Read-only: `loadApprovalQueue`, `loadDrafts`, `loadProcessed`; no
  transactions.

**Transactional requirements**:

- None. Read-only queries.

**Real-time requirements**:

- None. Data fetched on demand; plan mentions 30s polling for feed refresh.

---

## Summary Table

| Component       | Tables Used                                             | Transactions              | Real-time |
| --------------- | ------------------------------------------------------- | ------------------------- | --------- |
| queue-store     | workItems, gateEvaluations, proposedActions             | Yes (per signal)          | No        |
| ingestion-state | ingestionState                                          | No (standalone upserts)   | No        |
| run-log         | workflowRuns, workflowEvents                            | Via executor in parent tx | No        |
| approve-action  | workItems, proposedActions, gmailDrafts, calendarEvents | Yes (approval path)       | No        |
| queue-tool-call | workItems, proposedActions                              | Yes                       | No        |
| audit-log       | auditLogs                                               | Via executor in parent tx | No        |
| dashboard       | workItems, proposedActions, gateEvaluations, etc.       | No (read-only)            | No        |

---

## Recommendations

1. **ingestSignalsTask**: Consider wrapping `persistSignals` +
   `upsertUserIngestionState` in a transaction if cursor consistency with work
   items is required; current design tolerates re-ingestion.
2. **pruneWorkflowEvents**: Wrap delete-events and delete-runs in a single
   transaction to avoid partial deletes.
3. **Real-time**: No DB-level real-time requirements today; feed uses polling
   (stale-gated on open, cron every 5 min).
