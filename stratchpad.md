# Stratchpad — rewrite from scratch (DX-first)

## User constraints (hard)

- destructive rewrite allowed (`rm -rf` approved)
- switch DB fully to Postgres + Drizzle (PlanetScale Postgres path)
- use TanStack Query + TanStack Form
- use Effect-TS only if it improves extension/readability
- remove confusing/low-value files aggressively
- define exactly where PI is used and how to extend it
- avoid using the term “supervisor”

## Evidence index (repo)

### Runtime boundary is mostly conceptual today

- E1: apps/runtime exposes runtime endpoints, but web does not call them
  - source: apps/runtime/src/server.ts
  - source: `rg "runtime\." apps/web/src` => no runtime client/delegation usage
- E2: runtime ingest path is disabled intentionally
  - source: apps/runtime/src/command-handler.ts (`runtime.ingest` -> error)
- E3: runtime package is not operationally complete
  - source: apps/runtime/package.json (only `typecheck`, `clean`; no
    `dev/start/build`)

### Web/API surface is very small; architecture is over-provisioned

- E4: web API has only auth + sync poll routes
  - source: apps/web/src/app/api/auth/[...all]/route.ts
  - source: apps/web/src/app/api/sync/poll/route.ts
- E5: @nyte/application is largely unused by web
  - source: `rg "@nyte/application" apps/web/src` => only runtime-secrets bridge
    import

### DB stack is sqlite/libsql and must be replaced

- E6: better-auth adapter still sqlite
  - source: apps/web/src/lib/auth.ts (`provider: "sqlite"`)
- E7: db client is libsql + sqlite fallback to tmp file
  - source: packages/db/src/client.ts (`drizzle-orm/libsql`, `nyte-dev.sqlite`)
- E8: schema is sqlite-specific
  - source: packages/db/src/schema.ts (`sqliteTable`)
- E9: drizzle config uses sqlite dialect
  - source: packages/db/drizzle.config.ts (`dialect: "sqlite"`)

### Frontend state/forms are partial modern stack

- E10: TanStack Query is present and used
  - source: apps/web/src/components/providers.tsx
  - source: apps/web/src/features/home/use-nyte-workspace.ts
- E11: TanStack Form is not present at all
  - source: `rg "tanstack/form|react-form|useForm\("` => no matches

### Effect-TS and PI are not implemented in code

- E12: Effect-TS not present in repo code
  - source: `rg "from \"effect\"|@effect|\"effect\"" apps packages` => no
    matches
- E13: PI/OpenClaw/OpenPoke references only in planning text, not implementation
  - source: firstplan.old.md (mentions)
  - source: `rg "\bpi\b|openclaw|openpoke" apps packages` => no matches

### Naming mismatch to user preference

- E14: “supervisor” appears in historical plan text only
  - source: firstplan.old.md

## Evidence index (external)

- R1: Orchid article argues "Inbox Zero" keeps human as processor; desired shift
  is decision-focused escalation
  - https://orchid.ai/blog/the-end-of-inbox-zero
- R2: Poke docs/faq show practical integration-first assistant model + explicit
  privacy posture + MCP extension path
  - https://poke.com/docs
  - https://poke.com/faq
- R3: OpenPoke demonstrates interaction/execution split and scheduler/watcher
  pattern
  - https://github.com/shlokkhemani/openpoke
- R4: Drizzle PlanetScale Postgres docs support node-postgres and neon
  serverless options
  - https://orm.drizzle.team/docs/connect-planetscale-postgres
- R5: P- i mono repo https://github.com/badlogic/pi-mono
- R6: Trigger.dev docs show retries, idempotency, schedules, Next.js integration
  now
  - https://trigger.dev/docs/how-it-works
  - https://trigger.dev/docs/errors-retrying
  - https://trigger.dev/docs/idempotency
  - https://trigger.dev/docs/tasks/scheduled
  - https://trigger.dev/docs/guides/frameworks/nextjs

## Current thesis

1. Runtime app as currently implemented is a cognitive/deployment tax without
   active product value.
2. DB rewrite is mandatory before meaningful feature expansion.
3. We should simplify to clear planes and explicit ownership:
   - web (UI + thin API)
   - workflow runtime (Trigger tasks)
   - domain/application packages
4. Use Effect-TS selectively where orchestration complexity benefits from typed
   effects; avoid forcing effect across every utility path.

## Naming shift (no “supervisor”)

- Replace concept label with: **Decision Queue**
- UI shell label: **Operations Workspace**
- User role label: **Operator mode** (not supervisor)

## Hard delete candidates (expected)

- apps/runtime/\*\*
- packages/contracts/\*\* (if no remaining consumers)
- packages/db/drizzle/\*\* sqlite migration history (regenerate for postgres)
- packages/db/src/bootstrap.ts (sqlite bootstrap-only logic)
- stale plan/docs that conflict with rewritten architecture

## PI usage target (new)

- PI belongs only in runtime/task layer, not web routes.
- New package target: `packages/pi-runtime`
- PI extension units:
  - gmail.readThreadContext
  - gmail.saveDraft
  - calendar.createEvent
  - calendar.updateEvent
- extension contract includes schema, idempotency key, audit payload.

## DX outcomes required after rewrite

- A new engineer reads root README and knows:
  1. what runs where,
  2. what each package does,
  3. how a decision item moves from intake → queued action → approval →
     execution.
- No dead runtime path docs.
- No sqlite artifacts.
- No fake/local-only action handling in UI.
