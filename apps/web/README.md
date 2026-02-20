# web

## Purpose

Primary Nyte product surface: auth-first workspace UI plus a tRPC gateway.

## Responsibilities

- render landing/workspace flows and approval queue interactions
- manage Google auth connect/disconnect and session-aware UI state
- fetch and mutate queue state via TanStack Query + tRPC client hooks
- expose server-side procedures through `app/api/trpc/[trpc]/route.ts`
- map application/workflow errors to stable API-level `TRPCError` responses

## tRPC procedures

- `queue.sync`
- `actions.approve`
- `actions.dismiss`
- `actions.feedback`

## Key files

- `src/lib/server/router.ts`
- `src/lib/server/trpc.ts`
- `src/lib/server/context.ts`
- `src/hooks/use-workspace.ts`
- `src/components/workspace.tsx`

## Local commands

- `pnpm --filter web dev`
- `pnpm --filter web typecheck`
