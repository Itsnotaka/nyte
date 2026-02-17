# Plan v4 — destructive DX rewrite

## 0) Decision (firm)

- Remove split runtime app architecture as currently implemented.
- Move async orchestration to Trigger.dev tasks.
- Keep web as product surface + thin API gateway.
- Rewrite DB to Postgres (PlanetScale Postgres + Drizzle).
- Adopt TanStack Form in UI where user edits action payloads.
- Adopt Effect-TS **only** in runtime orchestration modules where typed effects
  improve clarity.

## 1) Evidence map (exact source)

### Repo evidence

- E1 Runtime endpoints exist but no web caller:
  - apps/runtime/src/server.ts
  - `rg "runtime\." apps/web/src` => no runtime client usage
- E2 Runtime ingest disabled:
  - apps/runtime/src/command-handler.ts (`runtime.ingest` returns bad_request)
- E3 Runtime not runnable app:
  - apps/runtime/package.json (no dev/start/build)
- E4 Web API scope is minimal:
  - apps/web/src/app/api/auth/[...all]/route.ts
  - apps/web/src/app/api/sync/poll/route.ts
- E5 Application package mostly unused by web:
  - `rg "@nyte/application" apps/web/src` => only lib/server/runtime-secrets
    bridge
- E6 Auth adapter still sqlite:
  - apps/web/src/lib/auth.ts (`provider: "sqlite"`)
- E7 DB client uses libsql/sqlite + tmp fallback:
  - packages/db/src/client.ts
- E8 DB schema is sqlite-core:
  - packages/db/src/schema.ts (`sqliteTable`)
- E9 Drizzle dialect is sqlite:
  - packages/db/drizzle.config.ts
- E10 TanStack Query already used:
  - apps/web/src/components/providers.tsx
  - apps/web/src/features/home/use-nyte-workspace.ts
- E11 TanStack Form missing:
  - `rg "tanstack/form|useForm\("` => no matches
- E12 Effect-TS missing:
  - `rg "from \"effect\"|@effect" apps packages` => no matches
- E13 PI/OpenClaw/OpenPoke absent in implementation:
  - present only in firstplan.old.md, not apps/packages
- E14 “supervisor” term appears in firstplan.old.md; user rejects term

### External evidence

- R1 Orchid: inbox zero keeps user as processor; move to decision-only
  interruption
  - https://orchid.ai/blog/the-end-of-inbox-zero
- R2 Poke docs/faq: integration-first, explicit privacy model, MCP extension
  option
  - https://poke.com/docs
  - https://poke.com/faq
- R3 OpenPoke: interaction/execution split + scheduler pattern
  - https://github.com/shlokkhemani/openpoke
- R4 Drizzle PlanetScale Postgres connection patterns (pg + neon serverless)
  - https://orm.drizzle.team/docs/connect-planetscale-postgres
- R5 Vercel Workflow is Beta; beta release phase has SLA caveat
  - https://vercel.com/docs/workflow
  - https://vercel.com/docs/release-phases
- R6 Trigger.dev has retries/idempotency/schedules + Next.js setup
  - https://trigger.dev/docs/how-it-works
  - https://trigger.dev/docs/errors-retrying
  - https://trigger.dev/docs/idempotency
  - https://trigger.dev/docs/tasks/scheduled
  - https://trigger.dev/docs/guides/frameworks/nextjs

## 2) Naming policy (replace “supervisor”)

- Product shell: **Operations Workspace**
- Primary queue: **Decision Queue**
- Mode naming: **Operator Mode**
- Remove “supervisor” from docs/UI labels.

## 3) Rewrite scope by area

## 3.1 Hard cuts (delete)

- apps/runtime/\*\*
- packages/contracts/\*\* (if no remaining imports after runtime removal)
- packages/db/drizzle/\*\* existing sqlite migration history
- packages/db/src/bootstrap.ts (sqlite bootstrap model)
- stale/duplicate plan docs that conflict with rewritten architecture

## 3.2 Mandatory rewrites

### apps/web

- Rewrite API routes into thin gateway routes:
  - `/api/queue/sync`
  - `/api/actions/approve`
  - `/api/actions/dismiss`
  - `/api/actions/feedback`
- Replace current direct sync route logic to runtime-trigger/task-trigger path.
- Replace contentEditable command editor with TanStack Form.
- Keep TanStack Query as canonical server-state mechanism.

### packages/db

- Move from sqlite/libsql to postgres driver.
- Replace schema from sqlite-core to pg-core.
- Set drizzle dialect to postgres.
- Add migration + seed strategy for fresh Postgres environment.
- Remove tmp sqlite fallback behavior.

### apps/web auth integration

- Switch better-auth Drizzle adapter provider to Postgres-compatible path.
- Validate session/account table mappings against rewritten schema.

### packages/application

- Keep only high-signal use-cases actually used by API/task paths.
- Remove dead utility surfaces.
- Keep grouped exports only (already in progress).

### new workflow runtime package (replace apps/runtime)

- Create `packages/workflows` (or `packages/tasks`) to host Trigger tasks.
- Task entrypoints:
  - ingestSignalsTask
  - approveActionTask
  - dismissActionTask
  - feedbackTask

### new PI extension package

- Create `packages/pi-runtime`.
- PI extension contract:
  - input schema
  - auth scope
  - idempotency key
  - audit payload
- Initial extensions:
  - gmail.readThreadContext
  - gmail.saveDraft
  - calendar.createEvent
  - calendar.updateEvent

## 4) Effect-TS usage policy (strict)

Use Effect-TS where it improves orchestration readability and failure semantics,
not everywhere.

### Adopt Effect-TS in

- packages/workflows task orchestration pipeline
- retry/backoff + timeout + typed domain errors
- external side-effect wrappers (gmail/calendar provider calls)

### Do not force Effect-TS in

- React UI
- simple mapping/presenter utilities
- DB schema definitions

### Backend style rule

- Route handler can be plain async.
- Route handler calls Effect program and maps typed failures to HTTP status.
- Keep one Effect runtime adapter module; avoid Layer-heavy architecture until
  needed.

## 5) SaaS replacement matrix (firm)

### Replace now

- Custom runtime app -> Trigger.dev tasks/runs
  - reason: E1/E2/E3 + R6

### Keep now

- Better Auth (with Postgres backend)
  - reason: already integrated, low migration overhead vs replacing auth stack
- Drizzle ORM
  - reason: already central + requested by user + R4 fit
- Gmail/Calendar integration code
  - reason: domain-specific behavior and approval gating logic

### Do not adopt now

- Vercel Workflow as core orchestrator
  - reason: Beta + SLA caveat (R5)

## 6) Phase plan (with acceptance criteria)

### Phase A — cleanup and architecture reset

- Delete runtime app and runtime-only contracts package (if unreferenced).
- Remove stale runtime env flags and stale docs references.
- Acceptance:
  - no import of `@nyte/contracts`
  - no `apps/runtime` in workspace
  - `pnpm typecheck` and `pnpm lint` pass

### Phase B — Postgres rewrite

- Rebuild packages/db for Postgres.
- Update drizzle config and generate fresh postgres migrations.
- Update auth adapter provider in apps/web/src/lib/auth.ts.
- Acceptance:
  - no sqlite/libsql imports left
  - no `sqliteTable` in schema
  - migrations apply on fresh Postgres

### Phase C — workflow runtime via Trigger.dev

- Add Trigger.dev setup and task package.
- Implement approve/dismiss/feedback/sync tasks using `@nyte/application`
  use-cases.
- Add idempotency keys to mutable operations.
- Acceptance:
  - web routes trigger tasks, not local fake state
  - task retries and failure logs visible

### Phase D — UI state + forms rewrite

- Keep TanStack Query as server-state source of truth.
- Introduce TanStack Form in command composer + action edit forms.
- Remove contentEditable command entry and ad hoc local form state.
- Acceptance:
  - all editable action payloads handled by TanStack Form
  - decision actions are query invalidation-driven

### Phase E — PI extensionization

- Introduce PI runtime package and extension registry.
- Route task execution calls through PI extension contracts.
- Acceptance:
  - PI only referenced by workflow/task layer
  - extension docs include how to add tools safely

### Phase F — docs + DX hardening

- Rewrite root README + package READMEs with architecture map.
- Add docs:
  - docs/architecture.md
  - docs/database-postgres.md
  - docs/workflows-trigger.md
  - docs/pi-runtime.md
  - docs/frontend-state.md
- Acceptance:
  - new engineer can boot project from README alone
  - docs map each package to responsibility + owner commands

## 7) Readme target (post-rewrite)

Root README must answer exactly:

1. What this product is: decision queue for email/calendar actions.
2. What runs where:
   - apps/web: UI + API gateway
   - packages/workflows: Trigger tasks
   - packages/pi-runtime: extension tools
   - packages/db: Drizzle Postgres schema/client
3. How data flows:
   - ingest -> triage -> decision queue -> approval -> execution -> audit
4. Local setup:
   - env, Postgres connect, migrate, run web + trigger dev
5. How to extend:
   - add a new PI extension
   - add a new workflow task
   - add a new decision gate

## 8) Risks + rollback

### Risks

- migration errors during DB rewrite
- task orchestration mismatch vs current web route expectations
- team confusion if Effect-TS is overused too early

### Mitigation

- keep effect usage bounded and documented
- route-level feature flags during rollout
- staged PRs with passing checks each phase

### Rollback

- tag before destructive delete
- phase-level branch cut
- revert to pre-rewrite tag if Phase B/C fails hard

## 9) Immediate next execution order

1. Phase A hard cuts
2. Phase B Postgres rewrite
3. Phase C Trigger task path
4. Phase D TanStack Form rollout
5. Phase E PI extension package
6. Phase F docs polish

## Unresolved questions

- postgres driver choice for deployment: `pg` only vs `@neondatabase/serverless`
  path for serverless constraints?
- do we keep `packages/application` name or rename to `packages/use-cases` for
  clarity?
- should we include Outlook in v1 integrations (Poke supports Gmail + Outlook)
  or stay Gmail-first?
