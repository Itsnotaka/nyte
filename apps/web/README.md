# web

## Purpose

Primary Sachi product surface: auth-first workspace UI with GitHub integration.

## Responsibilities

- render workspace flows, PR inbox, and code review interactions
- manage GitHub OAuth and session-aware UI state via Better Auth
- proxy Better Auth handlers through `app/api/auth/[...all]/route.ts`
- serve tRPC API through `app/api/trpc/[trpc]/route.ts`

## Routing conventions

Follows Graphite's URL model: clean root with sidebar repo selector, route
segments for entity-scoped views, query params only for filters.

### Root

```
/
```

No params. Sidebar dropdown defaults to the first repo. Repo selection is
client-side state, not encoded in the URL.

### Entity-scoped routes (route segments)

Routes that identify a specific resource use `/:org/:repo/...` segments. These
are shareable and bookmarkable.

```
/submit/:org/:repo/:number    Stack submit view
/pr/:org/:repo/:number        PR detail view
```

Examples:

- `/submit/Itsnotaka/Sachi/5`
- `/pr/Itsnotaka/Sachi/42`

### Filtered list routes (query params)

Routes that show filtered collections use flat query params for shareability.

```
/merges?org=:org&repo=:repo   Merge queue for a repo
/pulls?org=:org&repo=:repo    PR list for a repo
```

Examples:

- `/merges?org=Itsnotaka&repo=Sachi`
- `/pulls?org=Itsnotaka&repo=Sachi`

### Auth and setup

```
/login                         Sign in page
/setup                         GitHub App install flow
/setup/repos                   Repo picker (post-install)
/api/auth/[...all]             Better Auth handler
/api/trpc/[trpc]               tRPC handler
```

### Route groups

- `(protected)` -- requires session; layout checks auth and redirects to
  `/login` if unauthenticated. When installations exist, wraps children in
  `RepoProvider` for sidebar repo selection.

## Key files

- `src/lib/auth/server.ts` -- server-side session helpers
- `src/lib/github/server.ts` -- GitHub onboarding state and repo loading
- `src/app/(protected)/layout.tsx` -- protected layout with auth guard
- `src/app/(protected)/_components/repo-context.tsx` -- repo selection context
- `src/app/(protected)/app-shell.tsx` -- sidebar shell with repo selector
- `src/components/providers.tsx` -- client providers (tRPC, NuqsAdapter)

## Local commands

- `pnpm --filter web dev`
- `pnpm --filter web typecheck`

## Deployment

Vercel should deploy the web app only.

- Set the Vercel project Root Directory to `apps/web`
- Keep `@sachikit/cli` out of the web dependency graph
- Shared runtime packages used by the app, such as `@sachikit/db`,
  `@sachikit/github`, and `@sachikit/ui`, stay in scope
- Root `.vercelignore` explicitly excludes `packages/cli` from ad-hoc root
  deployments
