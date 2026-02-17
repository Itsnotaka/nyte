# Plan v2 (current request)

## 0) Guardrails

- scope tight: this request only
- no infra rewrite
- tanstack query only in apps/web client
- keep server/runtime/integrations on async/await fetch

## 1) Package docs

- create README.md in:
  - packages/application
  - packages/contracts
  - packages/db
  - packages/domain
  - packages/integrations
  - packages/ui
- each README sections:
  - Purpose
  - Responsibilities
  - Public exports
  - Dependencies
  - Used by
  - Local commands

## 2) TanStack Query migration (web)

- add @tanstack/react-query in apps/web
- add QueryClientProvider in apps/web/src/components/providers.tsx
- keep sync-client.ts as pure fetch+parse utility
- migrate apps/web/src/components/nyte-workspace-client.tsx:
  - replace manual runSync callback state with useMutation(syncNeedsYou)
  - map mutation pending/error/success to existing UI states
  - keep cursor handling + handled map + notice state
  - keep one-time auto sync on connect; prevent duplicate first run

## 3) Callback-style fetch cleanup

- runtime server: refactor apps/runtime/src/server.ts
  - remove readBody(...).then chain
  - use linear async control flow for body parse + command execution path

## 4) useEffect recheck

- app-level effects first:
  - nyte-workspace-client auto sync effect deps and guard correctness
  - workflow-composer contentEditable sync effect; keep only if required
- shared UI effects: no broad refactor in this pass unless bug found

## 5) Validation

- run targeted diagnostics on changed TS files
- run:
  - pnpm typecheck
  - pnpm lint
- fix any errors from changed files

## Unresolved questions

- should README scope include apps/_ and tooling/_ too, or packages/\* only?
- do you want runtime callback-chain cleanup included in this same pass, or only tanstack query + package docs now?
