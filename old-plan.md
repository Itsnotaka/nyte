Nyte plan — first-principles product + technical foundation Executive summary
Nyte should not be “another inbox.” It should be a design-first supervisor app
where email is context and the primary surface is a triage GUI, not chat. The
product goal is to move users from:

Processor mode (manual routing), to Supervisor mode (approve/edit prepared work
in a clean queue). The UX target is: Linear’s list/triage clarity + OpenClaw’s
explicit runtime discipline + Poke-style background orchestration, with chat as
secondary input.

Given the current repo is an early scaffold, execution should focus on one
polished vertical:

stabilize engineering baseline, establish auth/data/runtime primitives, build
Gmail intake and understanding, ship a high-quality “Needs You” queue with
email + Google Calendar actions.

1. Central product vision (first principles) Problem statement Inbox Zero
   optimizes queue management, not outcomes. Users still perform all cognitive
   routing. Nyte’s job is to eliminate low-value processing and escalate only
   true decision points.

Core promise “Tell me only what needs me, already prepared for one-click
approval.”

Revised attention policy (“Needs You” gates v2, design-first) A thread/task
enters the Needs You queue if at least one gate is true:

Decision Gate — Only you can decide (approval/choice/commitment). Time Gate — A
real deadline or scheduled time requires action soon. Relationship Gate —
Sender/context is sensitive enough that tone or ownership matters. Impact Gate —
Material impact (money, customer trust, project outcome) if ignored. Watch Gate
— You explicitly asked to be notified for this topic/person/account. Everything
else is quietly handled as:

Auto-prepared (drafted but not interrupting), Digest (batch summary), or
Archived signal (kept searchable, no interruption). MVP non-goal No fully
autonomous outbound execution without approval. MVP is human-in-the-loop by
design to build trust and learning loops.

2. “What would Linear-style GUI feel like with OpenClaw + Poke background?” Core
   experience shape Linear-like (front-end interaction model): keyboard-first
   command center and triage list, high-density status views, predictable
   workflows and fast state transitions, timeline/history per item, strong
   information hierarchy and minimal visual noise. OpenClaw-like: explicit agent
   loop runtime, serialized per-work-item execution lane, durable memory/context
   layer, tool/skill registry with observable tool calls. Poke-like (background
   orchestration model): integrations produce prepared actions in the
   background, natural-language command bar is available but not mandatory,
   explicit approval checkpoints before execution. Primary UI surfaces (MVP)
   Command Bar (top): “Gmail draft …”, “Schedule with …”, with context chips.
   Needs You Queue (default): card/list triage with one-click actions. Action
   Detail Drawer: editable structured form before approval (especially calendar
   setup). Workflow Timeline: compact, human-readable run history/tool events.
   Connections center: Gmail + Google Calendar only for MVP. Drafts: dedicated
   sidebar section for generated draft replies. Rules/Policy: lightweight watch
   rules and interruption preferences. Layout shell direction (MVP) Use shadcn
   sidebar components for information architecture and navigation scaffolding.
   Initial sidebar sections: Needs You Drafts Processed / Digest Connections
   Rules Chat vs GUI principle Chat is an input modality, not the core UI
   paradigm. Any task that benefits from explicit fields (date, attendees,
   location, agenda, tone) should open structured controls, not force free-text
   chat repair loops. Tool-call rendered UI pattern (calendar-focused) For
   scheduling flows, the agent should emit structured tool intents that the
   frontend renders into interactive forms/drawers (instead of continuing
   free-text chat). Conceptually similar to AI SDK/TanStack AI:

model/agent emits typed tool call + schema payload, UI maps tool type to
component (event form, slot picker, attendee editor), user edits/approves
structured payload, runtime resumes with approved arguments. 3) Technical
direction aligned to current stack Existing stack to keep Next.js app-router
(apps/web) Shared shadcn UI package (packages/ui) Monorepo via Turbo + pnpm OXC
lint/format stack New stack choices (as requested) Auth: Better Auth ORM/DB:
Drizzle + SQLite Agent substrate: pi/openclaw-inspired runtime integration UI:
shadcn components expanded for command center Recommended module boundaries
apps/web: app routes, server actions, route handlers, UI composition
packages/domain (new): decision gates, policy engine, workflow state machine
packages/db (new): drizzle schema/client/migrations packages/integrations (new):
provider adapters (gmail/google-calendar) packages/agent-runtime (new): pi
extension wrapper, tool registry, run orchestrator (If keeping fewer packages
initially, these can start under apps/web/lib/\* and be extracted later.)

MVP runtime implementation note Prefer custom pi extensions (similar to the
“mom” pattern) over introducing MCP in v1. MCP remains a future extension path,
not a day-1 requirement.

4. OAuth and mailbox connection strategy (Better Auth) Identity vs integration
   separation Treat these as distinct concerns:

App identity session (who is signed into Nyte) Connected account credentials
(what Nyte can act on) Do not assume sign-in provider scopes are sufficient for
mailbox automation.

Provider onboarding (MVP) Google/Gmail + Google Calendar only: Start with least
privilege for ingestion + draft prep + calendar planning. Recommended initial
scopes: Gmail: read-focused + draft-capable (no send in v1) Calendar:
calendar.events or narrower read/freebusy + create strategy depending on UX
choice. Escalate permissions only when corresponding actions are turned on.
Security requirements Encrypt refresh tokens before DB persistence. Record
granted scopes and consent timestamp. Build revoke/disconnect flows in
Connections center. Add audit events for every approved execution. 5) Data model
blueprint (Drizzle + SQLite) Core entities (MVP) users auth\_\* tables (Better
Auth adapter) connected_accounts (provider, external user id, scopes, token
refs, status) mail_threads (provider ids, participants, subject, recency,
importance signals) mail_messages (normalized metadata + body excerpt/embedding
ref) work_items (derived unit needing/possibly needing attention)
gate_evaluations (which of 5 gates fired + confidence/reason) proposed_actions
(draft email reply, calendar proposal, simple follow-up tasks) approval_requests
(status: pending/approved/rejected/expired) workflow_runs + workflow_events
(traceability and debugging) policy_rules (user watch rules, escalation
preferences) calendar_suggestions / calendar_events (proposed slots, attendees,
confirmation state) State model Work item lifecycle: ingested → analyzed → gated
if needs-you: awaiting_approval → executing → completed|failed else:
auto_processed|archived 6) Agent/runtime design (pi-mono + OpenClaw principles)
Runtime topology (GUI-first, background-agentic) Interaction layer (single
orchestrator): owns user-facing state and prepares cards/drawers. Execution
workers (specialized tasks): run tool operations (gmail read, draft prep,
calendar slotting). Workers report structured outputs back to interaction layer,
which updates queue items and approval states. This mirrors the useful part of
OpenPoke’s split (interaction vs execution) while keeping implementation lean.

Runtime contract Each run should be explicit and replayable:

Intake event (new mail/thread update/user command) Context assembly (thread
history + customer/account/tool context + policies) Plan generation (what
actions are proposed) Tool prep calls (read-only where possible) Approval
package generation (diff + impact summary) On approval: execution phase with
tool calls Persisted run summary + feedback signals Concurrency model Serialize
execution per work_item_id (lane model) to avoid race conditions. Support
bounded parallelism across different work items. Learning loop Capture
approval/rejection feedback and edits. Use these signals to tune prioritization,
writing style, and action templates. 7) Phased implementation plan with
acceptance criteria Phase 0 — Baseline stabilization (must-do first) Tasks:

Fix current lint/type/format baseline failures. Ensure reliable local scripts
(lint, format, typecheck, build). Clean obvious scaffold issues (broken
imports/config drift). Acceptance criteria:

pnpm lint passes. pnpm format passes. pnpm typecheck passes. pnpm build passes
for all workspaces. Phase 1 — Domain skeleton + database foundation Tasks:

Add Drizzle + SQLite setup and migration flow. Implement initial schema for
users/connections/work items/actions/approvals/runs. Seed minimal fixtures for
local iteration. Acceptance criteria:

Migrations generate/apply successfully. CRUD roundtrip tests for core entities.
Schema supports full work-item lifecycle transitions. Phase 2 — Auth and Google
account connections Tasks:

Integrate Better Auth into Next app router. Add sign-in/out/session guards. Add
Gmail + Google Calendar connection flows and token persistence. Build
Connections page with connect/disconnect/status. Acceptance criteria:

User can sign in and maintain session. User can connect/disconnect Gmail and
Google Calendar accounts. Tokens/scopes persist securely with audit records.
Phase 3 — Gmail ingestion + context assembly Tasks:

Build Gmail adapter for mailbox sync (polling-only MVP ingestion). Normalize
thread/message records. Implement lightweight context assembly service for a
thread/work item. Acceptance criteria:

New inbound email appears in local data model. Thread context object can be
generated deterministically. Sync cursors update reliably across retries. Phase
4 — Needs-you gate engine + action planner Tasks:

Implement revised 5-gate evaluation engine
(Decision/Time/Relationship/Impact/Watch). Create explanation payload per gate
decision. Implement first action templates: draft email reply, meeting proposal
with calendar slot options + tool-call rendered form payload, follow-up
reminder/task. Acceptance criteria:

Each work item has gate results with reasons. “Needs You” queue only contains
gate-positive items. Prepared action payloads are reviewable before execution.
Phase 5 — Design-first supervisor UI Tasks:

Replace hello-world page with command center UI. Build command bar + queue
list + item detail drawer + timeline + approval controls. Implement shadcn
sidebar shell with clear sections (including Drafts). Add keyboard shortcuts,
status filters, and polished microinteractions. Acceptance criteria:

User can triage all needs-you items from one screen. Approval action is one
click; edit action opens structured form. Timeline shows run steps/tool events
for transparency. Phase 6 — Approval execution + Google Calendar integration
Tasks:

Add execution handlers for approved actions (email draft create/update +
calendar create/update). Implement custom pi extensions for gmail/calendar
actions. Add execution rollback/failure handling patterns where possible.
Acceptance criteria:

Approved actions execute and persist outcomes. Failures are visible, retryable,
and auditable. Extension boundary supports adding future tools without core
rewrite. Phase 7 — Trust, metrics, and hardening Tasks:

Add analytics: interruption precision, approval rate, time-to-decision. Add
policy tuning UI and user feedback capture. Harden reliability, idempotency, and
security checks. Acceptance criteria:

Core product metrics are queryable in-app/admin logs. Duplicate execution
protections verified. Security review checklist completed for token and PII
handling. 8) Testing strategy Unit tests Gate engine logic (all 5 gates + edge
cases). Work-item state transitions. Policy rule parsing/evaluation. Integration
tests OAuth callback/token storage flows. Mail sync adapter normalization.
Approval-to-execution pipeline. End-to-end tests Sign in → connect mailbox →
ingest email → see needs-you item → approve action. Rejection/edit path and
learning signal persistence. Non-functional checks Idempotency tests for
execution handlers. Rate-limit/retry behavior for provider APIs. PII/token
handling validations. 9) Engineering guardrails (execution conventions)
Dependency installs: Do not hand-edit package.json to add dependencies. Use
package-manager commands for all additions. Monorepo standard: pnpm add
<package> --filter <workspace>. 10) Delivery order recommendation (pragmatic)
For fastest path to a meaningful demo:

Phase 0 Phase 1 Phase 2 (Google auth + connections) Phase 3 (Gmail polling
ingestion first) Phase 4 (gate engine + draft + calendar proposal templates)
Phase 5 (design-first supervisor UI) Phase 6 (execute one vertical end-to-end
reliably) Phase 7 (metrics/hardening) This creates a demoable “processor →
supervisor” shift early, then scales capability.

11. Confirmed scope decisions + remaining product choices Confirmed from latest
    direction MVP is design-first GUI triage, not chat-first. MVP mail flow is
    intake → understanding → prepared action. Database is local SQLite for now;
    migration path to Postgres later. Calendar integration is Google Calendar
    only for MVP. MVP should favor custom pi extensions over MCP. Email is
    read-only + draft-only in v1 (no send flow). Ingestion is polling-only for
    MVP. Calendar UX should use tool-call rendered structured UI controls.
    Calendar approval can immediately create the event. MVP navigation should
    include a Drafts sidebar item using shadcn sidebar styling. Strict logic +
    design-first principles are non-negotiable implementation constraints.
    Generated email drafts should be saved directly to Gmail Drafts immediately.
    Remaining choices to finalize before execution No open product-scope
    decisions remain for MVP planning.

12. Execution status snapshot (updated) MVP completion status Phase 0 ✅
    complete (format/lint/typecheck/build baseline stabilized) Phase 1 ✅
    complete (Drizzle + SQLite schema/migrations and lifecycle support) Phase 2
    ✅ complete (Better Auth session guards + Google connection vault handling)
    Phase 3 ✅ complete (polling-based Gmail ingestion + normalized work-item
    persistence) Phase 4 ✅ complete (5-gate engine + prepared actions and
    explanation payloads) Phase 5 ✅ complete (design-first supervisor shell
    with queue/drawer/timeline/rules/connections) Phase 6 ✅ complete (draft +
    calendar execution surfaces with idempotency protections) Phase 7 ✅
    complete (metrics, feedback, trust report, retention, encryption rotation,
    rate limiting, authz hardening) Additional hardening completed during
    execution Persistent workflow/event telemetry and admin trust reporting.
    Persistent audit logging for sensitive mutations with admin query endpoint.
    Token encryption key rotation + credential re-key operation. Runtime secret
    posture evaluation and surfaced warning states. Proxy-based response
    hardening, including no-store API controls and baseline CSP. Final
    architecture notes (implemented reality) UI composition uses the project’s
    current Base UI-backed @workspace/ui primitives. MVP remains polling-first,
    draft-only/read-only for email send semantics. Google Calendar is the only
    calendar integration in scope; event creation remains approval-gated.
13. New execution addendum (requested architecture shift) User-directed change:
    migrate from ad-hoc try/catch control flow to neverthrow result pipelines,
    and replace custom in-memory rate-limiter implementation with a
    package-based integration (targeting Unkey TS ratelimit).

Objectives Remove route/service error branching via repeated try/catch where
practical. Adopt neverthrow for explicit, typed error propagation at API
boundaries. Replace custom enforceRateLimit implementation with Unkey-backed
limiter flow. Avoid “helper inflation” naming patterns (*V2, *v3, or “enhanced”
duplicate wrappers). Preserve all existing HTTP contracts and tests
(401/400/409/415/429 semantics). Proposed implementation phases Phase A —
Baseline cleanup + dependency introduction Tasks:

Discard interrupted WIP introducing enforceRateLimitOr429 helper (conflicts with
new direction). Add dependencies: neverthrow @unkey/ratelimit Add environment
contract documentation for Unkey configuration (UNKEY_ROOT_KEY, namespace
strategy). Acceptance criteria:

Working tree starts from a clean baseline commit. New dependencies installed via
package manager. No behavior changes yet. Phase B — Typed error model +
neverthrow primitives Tasks:

Introduce shared Result/ResultAsync utility layer for API/server operations.
Convert auth guard path from thrown exceptions to result-returning APIs. Convert
JSON body parsing path to result-returning APIs (invalid-json,
unsupported-media-type, non-object, etc.). Ensure low-level parsing/crypto
wrappers use Result.fromThrowable/ResultAsync.fromPromise where applicable.
Acceptance criteria:

API routes can compose auth + parsing without local try/catch. Route status
mapping remains identical. Existing auth/json-body tests pass with no contract
regressions. Phase C — Unkey rate limiting integration Tasks:

Replace custom in-memory map limiter with Unkey client-backed limiter module.
Define per-scope rate-limit policy map (existing limits/windows preserved). Emit
standardized 429 responses with Retry-After derived from Unkey reset data.
Provide resilient non-production/test strategy that keeps tests deterministic
without external network flakiness. Acceptance criteria:

No API route imports legacy custom limiter implementation. Rate-limit tests and
route-level 429 assertions remain green. Production path uses package-backed
limiter logic. Phase D — Route-by-route neverthrow migration Tasks:

Refactor all API handlers to result pipelines: auth check → rate-limit check →
parse/validate → service call → response map. Remove duplicated local catch
blocks. Ensure service-layer errors map to existing HTTP codes
(404/409/500/etc.) via explicit typed matching. Acceptance criteria:

Route handlers no longer rely on repeated try/catch scaffolding. All API tests
pass unchanged in assertions. Phase E — Naming cleanup and consistency pass
Tasks:

Remove/rename internal function names that imply versioned/“better” variants for
custom helpers. Keep third-party package names as-is (e.g., Better Auth package)
while normalizing internal API naming. Acceptance criteria:

No custom *V2/*v3 symbols introduced. No new custom BetterXxx helper names.
Validation strategy for this addendum Full quality gates after each meaningful
slice: pnpm format pnpm typecheck pnpm --filter web test:api pnpm --filter web
test pnpm build pnpm lint Preserve current route-level behavioral contracts
exactly; no silent API contract changes. Addendum execution status (current)
Phase A ✅ complete (dependency introduction and conflicting WIP removal). Phase
B ✅ complete (neverthrow-based auth/json/result primitives in active route
paths). Phase C ✅ complete (@unkey/ratelimit integration with deterministic
non-key fallback behavior). Phase D ✅ complete (API handlers migrated to
result-based flow without local try/catch blocks). Phase E ✅ complete (custom
BetterXxx helper naming removed; no version-suffixed helper variants
introduced). 14) Architecture revision addendum (user-requested replan): package
boundaries + externally hosted runtime User guidance acknowledged:

Use anomalyco/opencode as architectural inspiration for package separation.
Avoid overbuilding infra that Vercel already handles for the web app. Prioritize
clean monorepo boundaries now because agent runtime will run outside Vercel with
full execution context. Why this replan is necessary Current implementation is
functionally complete for MVP, but most business logic still lives under
apps/web/lib/\*. That makes it harder to:

run long-lived agent execution outside Vercel, and share domain/use-case code
safely between web and runtime services. Observed current-state constraints
(from codebase reconnaissance) Web app is monolithic at runtime layer
apps/web/app/api/_ imports directly from apps/web/lib/server/_.
apps/web/lib/server/_ currently mixes orchestration, persistence, and execution
concerns. Domain logic is partially separated, but still app-local
apps/web/lib/domain/_ exists, but is not yet in reusable workspace packages.
Shared DB package exists and is reusable (@workspace/db) Good foundation for
cross-service usage. But DB URL resolution is currently local-path oriented in
packages/db/src/client.ts and needs runtime-host compatibility for remote DB
URLs. No explicit service boundary between UI/API gateway and runtime workers
Sync ingestion and execution happen in web API handlers today. Target
architecture (revised) Apps apps/web (Vercel) UI, auth/session, user-facing API
gateway, trust/admin read models. Thin orchestration only: validate request,
authorize, delegate to runtime application layer. apps/runtime (new, non-Vercel
host) Agent loop runner (poll/analyze/prepare/execute). Workflow orchestration
and provider side effects. Scheduled/background jobs and retry semantics.
Packages (workspace-shared) packages/domain Pure types + business rules (gates,
action payloads, state transitions). packages/application Use-case orchestration
(ingest, approve, dismiss, feedback, retention operations). No Next.js
dependencies. packages/integrations Gmail/Calendar provider adapters,
request/response normalization. packages/contracts Runtime API schemas/events
(zod or typed contracts) shared by web and runtime. packages/platform (optional,
if needed) Cross-cutting primitives that are not framework-specific (result
helpers, IDs, clocks). Keep @workspace/db as shared persistence package.

Runtime boundary contract (web ↔ runtime) Phase-1 contract (minimal infra):

Web invokes runtime over authenticated HTTP for explicit operations: POST
/runtime/ingest POST /runtime/approve POST /runtime/dismiss POST
/runtime/feedback Runtime performs durable writes and returns normalized result
payloads. Phase-2 contract (async hardening):

Introduce async dispatch for long-running jobs (queue or managed async trigger)
without changing business-layer contracts. Web stays responsive and displays
pending/executing states from shared DB. Data and hosting model requirements
Shared remote database is mandatory for split deployment. Both Vercel web and
external runtime must read/write the same store. Database URL handling must
support non-file URLs Current local path resolution behavior must be corrected
before runtime split rollout. Session/auth context propagation Web remains
source of user auth; runtime receives signed service claims (user id, request
id, permissions scope). Proposed implementation phases for this addendum R0 —
Architecture scaffolding (no behavior change) Create new workspace packages:
domain, application, contracts, integrations (or incremental subset). Move
existing pure modules (lib/domain/\*) into packages/domain. Add package export
surfaces and typecheck scripts. Acceptance:

No API contract changes. Existing tests remain green. R1 — Extract application
services from apps/web/lib/server Move use-case orchestration modules
(queue-store, approve-action, dismiss-action, feedback, workflow-retention,
metrics) into packages/application. Keep web-only adapters (authz, request
parsing, rate-limit response mapping) in apps/web. Acceptance:

Route handlers become thin adapters over application use-cases. API behavior
unchanged (status/body contracts preserved). R2 — Provider extraction and
runtime-safe abstractions Move Gmail/Calendar provider logic into
packages/integrations. Ensure provider clients are injectable and runtime-host
compatible. Acceptance:

No direct provider-specific logic in web route handlers. Integration tests for
ingestion + execution still pass. R3 — Contracts + runtime API seam Define typed
runtime command/result contracts in packages/contracts. Add runtime client in
web (lib/client/runtime-client) that talks to runtime service endpoints.
Acceptance:

Web can delegate at least one workflow operation through contract client behind
feature flag. R4 — Introduce apps/runtime service (initial deployment shape) New
service hosts application orchestration endpoints and background triggers. Web
delegates selected heavy operations (sync/poll, execution paths) to runtime.
Acceptance:

End-to-end supervisor flow works with runtime delegation enabled. Web remains
deployable on Vercel with minimal operational changes. R5 — Operational
hardening Idempotency/retry strategy at runtime boundary. Structured tracing +
correlation IDs across web and runtime. Failure-mode tests for partial runtime
outages. Acceptance:

Deterministic recovery behavior documented and tested. Trust/audit surfaces
include runtime-origin metadata. Out of scope for this replan slice Rebuilding
infra platform from scratch. Switching product UX direction (design-first shell
remains unchanged). Introducing broad multi-provider matrix beyond Gmail +
Google Calendar. Validation strategy for replan execution Preserve current
quality gates after each phase: pnpm format pnpm typecheck pnpm --filter web
test pnpm build pnpm lint Add new package-level tests as modules are extracted.
Add contract tests for web↔runtime boundary (request/response compatibility).
