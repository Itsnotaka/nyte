# web

## Purpose

Primary Nyte product surface: auth-first workspace UI backed by Convex.

## Responsibilities

- render landing/workspace flows and approval queue interactions
- manage Google auth connect/disconnect and session-aware UI state
- fetch and mutate queue state via Convex queries and mutations
- proxy Better Auth handlers through `app/api/auth/[...all]/route.ts`
- keep realtime queue state server-driven (no client sync invalidation)

## Key files

- `convex/queue.ts`
- `convex/actions.ts`
- `convex/agent.ts`
- `src/lib/auth-server.ts`
- `src/components/providers.tsx`

## Local commands

- `pnpm --filter web dev`
- `pnpm --filter web typecheck`
- `pnpm dlx convex dev`
