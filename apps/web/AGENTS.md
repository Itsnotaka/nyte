# Web App Agent Guidelines

## tRPC Server-Side Data & Prefetching

`~/lib/trpc/server` exports three things for RSC pages:

- **`caller`** -- direct tRPC procedure calls for server-only data (routing
  decisions, data the client never refetches). Does not touch the query cache.
- **`prefetch()`** -- fire-and-forget prefetch into TanStack Query cache so
  client components hydrate with data.
- **`HydrateClient`** -- passes dehydrated cache to the client.

### Rules

- Use `caller.*` for server-only data; do not use `queryClient.fetchQuery()`.
- Use `prefetch()` for client hydration; do not use
  `queryClient.prefetchQuery()` directly.
- Let server queries return data or fail; do not use `.catch()` to swallow
  errors.
- Prefetch every query that child client components use via
  `useQuery(trpc.*.queryOptions())`. Missing prefetches cause client-side
  fetches and slower paint.
