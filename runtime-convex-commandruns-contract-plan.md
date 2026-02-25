# Runtime ↔ Convex `commandRuns` Canonical Cutover Plan (Unreleased Build)

## Decision
This project is unreleased. We will use a **hard canonical cutover**:
- no backward compatibility aliases,
- no schema softening,
- no data migrations/backfills,
- no runtime fallbacks for missing canonical fields.

Any pre-canonical rows or code paths are treated as disposable and must be deleted.

---

## Canonical Contract Snapshot (current target)

### `commandRuns` schema (must remain strict)
**File:** `apps/web/convex/schema.ts` (~193-212)

```ts
commandRuns: defineTable({
  runId: v.string(),
  userId: v.string(),
  inputText: v.string(),
  status: runtimeRunStatusValidator,
  proposalJson: v.string(),
  retrievalHitsJson: v.string(),
  conversationJson: v.string(),
  followUpQuestion: v.optional(v.string()),
  executionJson: v.optional(v.string()),
  lastError: v.optional(v.string()),
  suggestionText: v.string(),
  riskLevel: runtimeRiskLevelValidator,
  triggerType: runtimeFlowTriggerTypeValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### Active writer paths (already canonical shape)
**File:** `apps/web/convex/agent.ts`
- insert in `storePreviewRun` (~430-443) includes `conversationJson`
- patch in `updateRunTurn` (~502-511) includes `conversationJson`
- confirm success/failure patches (~594-600, ~661-665)

### Runtime turn producer
**File:** `packages/pi-runtime/src/command-intelligence.ts` (~97-135)
- `RuntimeCommandTurnResult.status` = `"awaiting_follow_up" | "awaiting_approval"`
- `proposal` + `retrievalHits` are required

---

## Mandatory Deletion Manifest (exact non-canonical code to remove)

## 1) Remove deprecated `agent.run` surface entirely
**File:** `apps/web/convex/agent.ts`
**Lines:** ~887-897
**Delete block:**

```ts
export const run = mutation({
  args: {
    message: v.string(),
    parts: v.optional(v.array(promptPartValidator)),
  },
  handler: async () => {
    throw new ConvexError(
      "agent.run is deprecated. Use preview/respond/confirm inline flow."
    );
  },
});
```

Reason: canonical API is `preview/respond/confirm`; keeping dead API preserves drift vectors.

## 2) Remove flow trigger usage of deprecated `agent.run`
**File:** `apps/web/convex/flows.ts`
**Lines:** ~47-49
**Delete block:**

```ts
const runResult = await ctx.runMutation(api.agent.run, {
  message,
});
```

## 3) Remove legacy `itemId` extraction fallback from flow audit payload
**File:** `apps/web/convex/flows.ts`
**Lines:** ~58-63
**Delete block:**

```ts
itemId:
  typeof runResult === "object" &&
  runResult !== null &&
  "itemId" in runResult
    ? ((runResult as { itemId?: string }).itemId ?? null)
    : null,
```

Reason: this is a legacy shape assumption. Flow audit should log canonical `runId` only.

## 4) Remove status alias backward compatibility in command input parser
**File:** `apps/web/src/app/(protected)/_components/command-input.tsx`
**Lines:** ~95-99
**Replace with canonical-only checks** (remove `waiting_*` aliases)

Current code to remove:

```ts
if (value === "awaiting_approval" || value === "waiting_approval") {
  return "awaiting_approval";
}
if (value === "awaiting_follow_up" || value === "waiting_follow_up") {
  return "awaiting_follow_up";
}
```

Canonical target behavior: accept only `awaiting_approval` and `awaiting_follow_up`.

## 5) Remove runtime output fallback defaults in command intelligence
**File:** `packages/pi-runtime/src/command-intelligence.ts`
**Lines:** ~377-387
**Delete fallback behavior:**

```ts
const summary =
  asNonEmptyString(parsed.summary) ?? request.message.trim().slice(0, 300);
const preview =
  asNonEmptyString(parsed.preview) ?? fallbackPreviewFromPayload(payload);
const suggestionText =
  asNonEmptyString(parsed.suggestionText) ??
  "Adjust this prompt if you want a different action.";
```

Canonical target behavior: missing `summary`, `preview`, or `suggestionText` is a hard error.

## 6) Remove stored proposal parse fallback defaults
**File:** `apps/web/convex/agent.ts`
**Lines:** ~173-175, ~200
**Delete fallback behavior:**

```ts
const context =
  asNonEmptyString(parsed.context) ??
  "Generated from inline command conversation.";

suggestedContactEmail: suggestedContactEmail ?? undefined,
```

Canonical target behavior: `context` must be present in stored proposal JSON; no synthetic default string.

## 7) Delete unused parallel abstraction file
**File:** `apps/web/convex/lib/agent.ts`
**Lines:** entire file (1-30)
**Delete file:** `apps/web/convex/lib/agent.ts`

Reason: unreferenced helper creates alternate runtime path and defaulted conversation fallback.

---

## Canonical Replacements Required After Deletions

## A) Replace flow runtime entrypoint with canonical preview path
`flows.triggerFlowRun` must stop calling a deprecated mutation and call a canonical entrypoint that returns `{ runId, status, followUpQuestion, proposal }`.

Implementation shape:
- Introduce a single internal action entrypoint in `apps/web/convex/agent.ts` for flow/event/schedule invocations (explicit `triggerType`).
- Update `apps/web/convex/flows.ts` to call that canonical action path.
- Audit payload in flows should record `runId` (not `itemId`).

## B) Enforce explicit trigger type (no defaulting)
**File:** `apps/web/convex/agent.ts` (`preview`)
- remove optional `triggerType` arg semantics
- remove `const triggerType = args.triggerType ?? "manual";`
- require explicit trigger type from every caller

Callsites to update:
- `apps/web/src/app/(protected)/_components/command-input.tsx` (already passes `triggerType: "manual"`)
- flow/event/schedule callers must pass their actual trigger type explicitly

## C) Keep strict schema; do not add temporary optional wrappers
**File:** `apps/web/convex/schema.ts`
- do not wrap `conversationJson` in `v.optional(...)`
- do not add legacy statuses (`queued`)
- do not add legacy fields (`queueItemId`, `requiresClarification`)

---

## UI Construction Alignment (Interview + Mockups, 2026-02-24)

1. **Screen composition target (top → bottom)**
   - "What's new?" heading
   - `Summary` section heading only (no generated paragraph in this phase)
   - `Review & Reply` list
   - bottom command composer

2. **Review list data source is canonical-only**
   - Source of truth: `commandRuns`
   - Filter: `status = "awaiting_approval"`
   - Order: newest `updatedAt` first
   - No `queueItems` fallback, no dual-read merge

3. **Review card interaction model**
   - Primary action label: `Review Reply`
   - Action opens run detail bound by `runId`
   - List cards do **not** execute approval directly

4. **Follow-up state placement**
   - `awaiting_follow_up` runs stay in the bottom composer loop only
   - They are excluded from the `Review & Reply` list

5. **Run-detail editing semantics**
   - Draft edits are local until user sends
   - Send path is sequential: `agent.respond` with edited text, then `agent.confirm`
   - No direct mutation path that edits stored proposal fields outside canonical turn handling

This UI construction section is additive. It does not change the hard cutover policy or canonical schema strictness.

---

## Implementation Blueprint (Plan-Only, No Code Changes in This Phase)

### 1) Backend contract shape to implement

#### Agent runtime boundary (`apps/web/convex/agent.ts`)
- Keep public runtime family as canonical: `preview`, `respond`, `confirm`.
- `preview` contract requires explicit `triggerType` from all callers (no optional arg, no defaulting).
- Add one internal runtime entrypoint for non-interactive triggers:
  - `internalAction previewFromFlowTrigger({ userId, message, parts?, triggerType })`
  - Return shape: `{ runId, status, followUpQuestion, proposal }`.
- Remove deprecated public `run` mutation entirely.
- Stored proposal parsing remains strict: `summary`, `context`, `preview`, `suggestionText`, `riskLevel`, and `payload` must all be valid.

#### Flow boundary (`apps/web/convex/flows.ts`)
- `triggerFlowRun` becomes a canonical adapter that:
  1. Loads flow definition, verifies ownership and active state.
  2. Calls `internal.agent.previewFromFlowTrigger` with flow’s persisted `triggerType`.
  3. Records audit payload with `{ triggerType, runId, status }` only.
- Remove all `api.agent.run` usage and all `itemId` extraction logic.
- Keep manual/event/schedule trigger wrappers thin; no alternate runtime semantics per wrapper.

#### Runtime model output boundary (`packages/pi-runtime/src/command-intelligence.ts`)
- Remove fallback defaults for missing `summary`, `context`, `preview`, and `suggestionText`.
- Missing required fields becomes hard failure from turn parsing.
- Keep explicit status mapping only: `awaiting_follow_up | awaiting_approval`.

### 2) New UI architecture from mockups

#### Screen composition (`apps/web/src/app/(protected)/page.tsx` + child components)
1. Top heading: `What's new?`
2. `Summary` block: heading only in this cut (no generated paragraph yet)
3. `Review & Reply` list (cards from canonical `commandRuns`)
4. Bottom composer (existing command input follow-up loop)

#### Review list data model (new/updated query layer in `apps/web/convex`)
- Source: `commandRuns` only.
- Filter: `status === "awaiting_approval"`.
- Sort: `updatedAt desc`.
- Card item minimum shape:
  - `runId`, `summary`, `preview`, `cta`, `source/type`, `riskLevel`, `updatedAt`.
- No queue-backed dual-read and no bridge fields.

#### Review detail interaction model (new UI state in web app)
- Clicking `Review Reply` opens detail view keyed by `runId`.
- Detail editing is local-first (textarea/editor state only).
- Send path is strictly sequenced:
  1. `agent.respond({ runId, message: editedText, parts })`
  2. validate response status is `awaiting_approval`
  3. `agent.confirm({ runId })`
- If respond returns `awaiting_follow_up`, keep user in composer loop and do not auto-confirm.

#### Composer responsibilities (existing `command-input.tsx`)
- Continue owning `awaiting_follow_up` conversation loop.
- Continue owning mention/contact parsing and follow-up replies.
- Do not inject follow-up runs into review list until status transitions to `awaiting_approval`.

### 3) File-by-file execution order for the future implementation PR

Phase A — Contract cutover core
- `apps/web/convex/agent.ts`
- `apps/web/convex/flows.ts`
- `packages/pi-runtime/src/command-intelligence.ts`
- `apps/web/src/app/(protected)/_components/command-input.tsx`
- delete `apps/web/convex/lib/agent.ts`

Phase B — Canonical review-query surface for UI
- Add/update query to fetch `commandRuns` review list projection (Convex module placement up to implementer).
- Ensure response object is UI-stable and excludes non-canonical compatibility fields.

Phase C — Review list + detail UI build
- `apps/web/src/app/(protected)/page.tsx`
- `apps/web/src/app/(protected)/_components/command-center.tsx`
- `apps/web/src/app/(protected)/_components/notification-feed.tsx` (or replacement component)
- `apps/web/src/app/(protected)/_components/work-item-card.tsx` + primitives
- introduce detail panel component keyed by `runId`

Phase D — Verification + unreleased-data hygiene
- Run mandatory typechecks (domain, extension-runtime, web).
- Run negative grep checks from this plan.
- One-time manual purge of non-canonical `commandRuns` rows in dev deployment before final behavior verification.

### 4) Failure modes to guard against during implementation

1. **Accidental dual-source UI**
   - Symptom: list reads `queueItems` and `commandRuns` together.
   - Guardrail: reject any PR introducing merged feed adapters or fallback selectors.

2. **Implicit trigger type drift**
   - Symptom: triggerType defaults to `manual` in preview path.
   - Guardrail: require all preview callers to pass explicit triggerType.

3. **Silent runtime quality regression**
   - Symptom: model omits summary/preview/suggestion/context but UI still renders due defaults.
   - Guardrail: hard-throw in parser; verify with negative tests.

4. **Confirm without up-to-date edited proposal**
   - Symptom: detail edit sends confirm without respond refresh.
   - Guardrail: keep explicit `respond -> confirm` sequence in review detail action.

---

## Implementation PR Acceptance + Rollback Guardrails

### Acceptance checklist (must all pass together)
1. **API contract checks**
   - `agent.run` does not exist in code or function spec.
   - `agent.preview` requires `triggerType` (no optional semantics).
   - Flow trigger path calls canonical internal preview entrypoint and logs `runId`.

2. **Runtime strictness checks**
   - Turn parser throws if `summary/context/preview/suggestionText` missing.
   - No parser fallback strings remain for proposal or suggestion content.

3. **UI behavior checks against this mockup-driven plan**
   - `Review & Reply` list is sourced from `commandRuns` awaiting approval.
   - `Review Reply` opens run detail by `runId` (not one-click approve).
   - Detail send path enforces `respond -> confirm`.
   - `awaiting_follow_up` remains in composer loop and is absent from review list.

4. **Data policy checks (unreleased)**
   - Manual purge of non-canonical `commandRuns` rows completed before final behavior verification.
   - Post-purge seeding occurs only through canonical preview/respond/confirm paths.

### Rollback guardrails
- If any acceptance item fails, rollback the entire cutover patchset; do not add compatibility shims.
- Do not ship mixed state where `agent.run` is removed in code but still referenced by flows/UI.
- Do not ship mixed state where review UI reads both `queueItems` and `commandRuns`.
- If runtime strictness causes frequent parse failures, fix prompt/output contract first; do not reintroduce fallback defaults.

---

## Data Policy for Unreleased Cutover (No Migration)

Because this is unreleased, legacy data is deleted, not transformed.

1. Purge non-canonical `commandRuns` documents before final verification.
2. If needed, purge related dev-only derived rows that depend on legacy runs.
3. Re-seed only through canonical `preview/respond/confirm` paths.

No backfill scripts. No temporary compatibility schema. No dual-read or dual-write windows.

---

## Verification Gates (must pass before merge)

1. **Type checks**
   - `pnpm --filter @nyte/domain typecheck`
   - `pnpm --filter @nyte/extension-runtime typecheck`
   - `pnpm --filter web typecheck`

2. **Contract behavior checks**
   - preview creates `commandRuns` row with `conversationJson` present
   - respond updates `proposalJson`, `retrievalHitsJson`, `conversationJson`, `status`
   - confirm writes `executionJson` and `status="completed"`
   - flow trigger creates canonical run (no `agent.run` usage)

3. **Negative checks**
   - no references to `api.agent.run` remain
   - no references to `waiting_approval` or `waiting_follow_up` remain
   - no fallback defaulting for command summary/preview/suggestionText/context remains

---

## Definition of Done
- Deprecated and compatibility code listed above is removed.
- Runtime and flow paths use one canonical command-run entrypoint family.
- Only canonical statuses and fields exist in code and stored rows.
- Strict schema remains strict; no migration/fallback scaffolding is introduced.