# Stratchpad

## Scope from user

- Read old-plan.md + MVP_STATUS.md
- Add README on each package so package purpose is clear
- Fetch calls should never be callback style
- Migrate client fetch flow to @tanstack/query
- Recheck useEffect usage

## Current repo findings

### Package documentation gap

- packages/application: use-case/services layer (queue, approvals, audit, trust, retention)
- packages/contracts: runtime command/result contracts + runtime guards
- packages/db: drizzle schema + client + bootstrap
- packages/domain: pure business logic (triage, action payloads, deterministic execution)
- packages/integrations: Gmail + Google Calendar polling adapters
- packages/ui: shared UI primitives/hooks
- No package-level README files currently present

### Fetch + callback usage

- apps/web/src/lib/needs-you/sync-client.ts uses async/await fetch (good)
- apps/web/src/components/nyte-workspace-client.ts wraps sync in callback function + manual loading/error state (migrate target)
- apps/runtime/src/server.ts has callback-style chain (`readBody(...).then(...)`) (should be converted to linear async flow)
- packages/integrations/\* polling uses async/await fetch (server-side, keep plain fetch)

### useEffect audit snapshot

- apps/web/src/components/nyte-workspace-client.ts: auto-sync on connect; valid but tied to manual callback state
- apps/web/src/components/workflow-composer.tsx: contentEditable value sync effect; valid guard exists
- packages/ui effects are mostly library internals (carousel/sidebar/calendar/mobile hook) and not part of app-specific fetch migration

## Direction

- TanStack Query only for apps/web client data fetching/mutation state
- Keep route handlers/runtime/integrations on async/await fetch
- Replace manual runSync callback state with useMutation-based state in nyte-workspace-client
- Keep behavior parity (same UX for loading/error/empty states)
- Add package README files with consistent sections: Purpose, Responsibilities, Exports, Used by, Commands

## Risks

- accidental UX changes during sync-state migration
- accidental duplicate autosync triggers
- over-scoping useEffect refactors in shared UI primitives

## Acceptance bar

- package README exists for each folder in packages/\*
- web sync flow uses @tanstack/react-query mutation state (no callback-driven fetch orchestration)
- runtime callback-style fetch chain removed (linear async handling)
- no behavior regression in connect/sync/error states
- typecheck + lint clean
