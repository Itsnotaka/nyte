# Scratchpad — Nyte Refactor

## Goal
- Flatten `features/home/` → components live in `src/components/`
- Replace 4 raw API routes with a single tRPC handler
- Delete all manual fetch boilerplate (sync-client, actions-client, request-validation, workflow-route-error, needs-you-route-config)
- Rename components to plain names (no "needs-you-*", "nyte-workspace-*" prefixes)
- Redesign UI with distinctive aesthetic

## File Inventory

### apps/web/src

| File | Status | Notes |
|------|--------|-------|
| `app/page.tsx` | KEEP/EDIT | update imports |
| `app/layout.tsx` | KEEP | unchanged |
| `app/loading.tsx` | EDIT | remove HomePageFallback import |
| `app/error.tsx` | KEEP | |
| `app/api/auth/[...all]/route.ts` | KEEP | unchanged |
| `app/api/queue/sync/route.ts` | DELETE | replaced by tRPC |
| `app/api/actions/approve/route.ts` | DELETE | replaced by tRPC |
| `app/api/actions/dismiss/route.ts` | DELETE | replaced by tRPC |
| `app/api/actions/feedback/route.ts` | DELETE | replaced by tRPC |
| `app/api/trpc/[trpc]/route.ts` | NEW | single tRPC handler |
| `components/providers.tsx` | EDIT | add TRPCProvider |
| `components/landing.tsx` | NEW | from home-landing.tsx + redesign |
| `components/workspace.tsx` | NEW | merge nyte-workspace-client + view + redesign |
| `components/composer.tsx` | NEW | from workflow-composer.tsx + redesign |
| `components/action-card.tsx` | NEW | merge needs-you-card + needs-you-action-content + redesign |
| `components/action-list.tsx` | NEW | from needs-you-list.tsx |
| `components/needs-you-action-content.tsx` | DELETE | merged into action-card |
| `components/needs-you-card.tsx` | DELETE | renamed action-card |
| `components/needs-you-list.tsx` | DELETE | renamed action-list |
| `components/workflow-composer.tsx` | DELETE | renamed composer |
| `components/nyte-workspace-client.tsx` | DELETE | one-line re-export, useless |
| `features/home/home-landing.tsx` | DELETE | moved to components/landing |
| `features/home/home-page-server.tsx` | DELETE | moved to page.tsx |
| `features/home/home-page-fallback.tsx` | DELETED | already gone |
| `features/home/nyte-workspace-client.tsx` | DELETE | renamed workspace |
| `features/home/nyte-workspace-view.tsx` | DELETE | merged into workspace |
| `features/home/use-nyte-workspace.ts` | DELETE | moved to hooks/use-workspace |
| `features/home/index.ts` | DELETE | barrel was only used here |
| `hooks/use-workspace.ts` | NEW | rewritten with tRPC |
| `lib/auth.ts` | KEEP | |
| `lib/auth-client.ts` | KEEP | |
| `lib/auth-provider.ts` | KEEP | |
| `lib/trpc.ts` | NEW | createTRPCContext → useTRPC, TRPCProvider |
| `lib/needs-you/actions-client.ts` | DELETE | replaced by tRPC mutations |
| `lib/needs-you/sync-client.ts` | DELETE | replaced by tRPC query |
| `lib/needs-you/sync-query.ts` | DELETE | URL params no longer needed |
| `lib/needs-you/routes.ts` | DELETE | tRPC router is the route |
| `lib/needs-you/messages.ts` | KEEP | |
| `lib/needs-you/presenters.ts` | KEEP | |
| `lib/shared/value-guards.ts` | KEEP | used by session-user-id |
| `lib/shared/session-user-id.ts` | KEEP | |
| `lib/shared/watch-keywords.ts` | KEEP | |
| `lib/server/env.ts` | KEEP | |
| `lib/server/needs-you-route-config.ts` | DELETE | replaced by tRPC config per-procedure |
| `lib/server/workflow-route-error.ts` | DELETE | replaced by TRPCError |
| `lib/server/request-validation.ts` | DELETE | replaced by Zod in router |
| `lib/server/request-log.ts` | KEEP | used in tRPC middleware |
| `lib/server/request-session.ts` | KEEP | used in tRPC context |
| `lib/server/request-events.ts` | KEEP | event name constants |
| `lib/server/trpc.ts` | NEW | initTRPC, procedures, middleware |
| `lib/server/context.ts` | NEW | createContext |
| `lib/server/router.ts` | NEW | AppRouter |

### packages (read-only, no changes)

| Package | Notes |
|---------|-------|
| `packages/domain` | types + guards, unchanged |
| `packages/workflows` | task runners, unchanged |
| `packages/application` | business logic, unchanged |
| `packages/db` | drizzle client + schema, unchanged |
| `packages/integrations` | gmail/calendar polling, unchanged |
| `packages/pi-runtime` | pi extension execution, unchanged |
| `packages/ui` | shadcn components, unchanged |
