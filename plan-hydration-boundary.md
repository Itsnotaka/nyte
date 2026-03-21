# Hydration Boundary Plan

## Executive judgment

Short answer: yes, `prefetch` can make client components feel instant, but it only helps when it removes a client-side waterfall without dragging route rendering into a server-side waterfall.

Right now the core problem is not “we need more prefetch.” The core problem is that our client/server boundaries are still too coarse on several routes, so the app sometimes does expensive work in the route render path instead of letting a real static shell paint first.

The plan is:

1. keep the protected chrome and route frame as static as possible,
2. use `loading.tsx` for dynamic route segments so Next.js can partially prefetch and show immediate loading UI,
3. move route data ownership to the client only where that route is highly interactive,
4. reserve server prefetch for small, truly above-the-fold data that materially improves the first painted content,
5. keep heavy panels behind nested Suspense boundaries,
6. validate every step by bootstrapping an authenticated browser session with Playwright and then running `next-browser` against the same login state for PPR inspection.

The validation split:
- **Playwright** (persistent profile): log in once on the real site, extract the auth cookies, and refresh that cookie jar when the session expires
- **`next-browser`**: run authenticated PPR shell analysis, screenshots, error/log inspection, route metadata, and network traces with `--cookies-json`

This is a boundary plan, not a rewrite plan. The goal is to reduce friction with the fewest moving parts.

---

## What we learned

### 1. The browser cache already exists

The app already has the most important client-side primitive: one browser `QueryClient` that survives client-side navigation within a live session.

- `apps/web/src/components/providers.tsx`
- `apps/web/src/lib/trpc/query-client.ts`

That means the browser can reuse query data across route transitions if:

- the query stays within `staleTime`,
- the route does not force a fresh server-side data path before the client can reuse the cache,
- and we do not invalidate the query ourselves.

### 2. Prefetch is useful, but only when it hydrates the right thing

From the current TanStack Query guidance:

- server prefetch + `HydrationBoundary` is appropriate when it prevents a client spinner for data we definitely want on the first render,
- queries that are not prefetched are allowed to fetch on the client after interactivity,
- and SSR setups should use a non-zero `staleTime` to avoid immediate client refetch.

This means the correct question is not “should we prefetch?” The correct question is:

“Should this data be part of the route shell, or should it be a client-owned island behind a real fallback?”

### 3. Next.js PPR is boundary-sensitive

From the Next.js App Router guidance:

- content outside Suspense can be part of the static shell,
- the fallback inside Suspense becomes part of the shell,
- the async content inside the boundary becomes a dynamic hole,
- and siblings inside that same boundary are excluded from the shell too.

That last point matters a lot. If we put too much page structure inside one boundary, we accidentally turn large parts of the screen into a dynamic hole.

### 4. `loading.tsx` is a high-leverage missing piece

Next.js documents that:

- `loading.tsx` automatically wraps a route segment in Suspense,
- it provides an immediate loading state during navigation,
- and for dynamic routes, partial prefetching improves when `loading.tsx` exists.

This is a very good fit for this app, because most of our friction happens on dynamic routes:

- `/repo/[owner]/[repo]`
- `/repo/[owner]/[repo]/pull/[number]`
- `/repo/[owner]/[repo]/pulls`
- `/repo/[owner]/[repo]/blob/[...path]`
- `/repo/[owner]/[repo]/tree/[...path]`

### 5. We already made one useful move

The first round of changes moved the PR detail page closer to the right shape:

- the route itself no longer prefetches the whole page payload,
- the page renders a faithful PR-shaped shell first,
- the top-level PR query is now client-owned,
- and discussion, diff, checks, and stack still stream under nested Suspense.

That shape is directionally correct. The remaining work is to generalize the same model to the repo/tree/blob/pulls family and to tighten when we do and do not hydrate server-prefetched data.

---

## Current state

### Good

- `apps/web/src/app/(protected)/layout.tsx` is now mostly shell-only: auth gate plus shared protected layout.
- `apps/web/src/app/(protected)/page.tsx` now does cheap onboarding gating and lets `InboxView` own the data.
- `apps/web/src/app/(protected)/repo/_components/pull-request-view.tsx` now renders a real PR shell first and lets the top-level PR data come from a client `useQuery`.
- `apps/web/src/app/(protected)/repo/_components/pull-request-view.tsx` still uses nested Suspense for the slow regions, which is the right progressive rendering model.
- query stale windows are already non-zero on many route queries.

### Still weak

- the repo browser, tree, blob, and pulls routes are still server-data pages, so they remain in the route render path on navigation,
- dynamic route segments do not yet use `loading.tsx`, so Next cannot give us the best partial-prefetch / immediate-transition behavior on those routes,
- `HydrateClient` still exists at the protected layout level even when a segment may not actually be hydrating server-prefetched route data,
- shell and data ownership are not expressed consistently across route families,
- and we have not yet re-run a route-by-route PPR audit after a full boundary cleanup.

### Important nuance

We should not “fix” this by converting everything to client fetches blindly.

Server-side ownership is still correct for:

- auth gating,
- redirect decisions,
- cheap parameter validation,
- tiny metadata that meaningfully improves the shell,
- and truly server-only data that the client never needs to refetch.

The plan is to move only the interactive screen data, not every read in the app.

---

## Target model

Each major route should follow this layered shape:

1. **Server route gate**
   - validate params,
   - do auth / redirect checks,
   - do not block on heavy page data,
   - render immediately.

2. **Segment loading UI**
   - use `loading.tsx` for dynamic segments,
   - show a real route-shaped skeleton,
   - let Next partially prefetch dynamic routes.

3. **Static route frame**
   - sidebar, page chrome, section headers, breadcrumbs, table headers, toolbar layout,
   - keep these outside the slowest boundaries when possible.

4. **Client-owned route data**
   - use `useQuery` / `useInfiniteQuery` for the top-level interactive screen data,
   - give route queries a real `staleTime`,
   - optionally use placeholder strategies for query-key transitions.

5. **Nested dynamic islands**
   - diff,
   - discussion,
   - checks,
   - stack,
   - secondary side panels,
   - lower-page or interaction-triggered content.

This is the boundary rule:

- use `loading.tsx` for segment-level navigation fallback,
- use local Suspense for nested regions inside an already-mounted route,
- use server prefetch only if it improves the shell more than it delays it.

---

## Guardrails

### 1. Prefer fewer boundaries, but place them higher quality

We do not want boundary spam. We want a few boundaries that map to real user-visible chunks:

- route shell,
- top-level screen data,
- heavy secondary panels.

Bad:

- one giant boundary around the entire page,
- or dozens of tiny boundaries around every minor widget.

Good:

- one route-level skeleton via `loading.tsx`,
- one top-level client data boundary if needed,
- 2-4 nested boundaries for genuinely slow subtrees.

### 2. Only hydrate what was actually prefetched

If a segment does not server-prefetch any query, it should not need a route-local `HydrateClient`.

That means:

- keep `HydrateClient` where we intentionally server-prefetch,
- remove page-local hydration wrappers when the route is fully client-owned,
- and avoid serializing empty dehydrated state just because it is already there.

### 3. Keep static siblings outside slow boundaries

If a section title, toolbar, breadcrumb, or table header can render without data, keep it outside the data boundary.

This is especially important for PPR because content inside the same boundary can disappear from the static shell even if it looks structurally “static” in the component tree.

### 4. Prefer query cache reuse over server re-orchestration

For highly interactive routes, the browser cache should do most of the work after the first hit.

That means:

- stable query keys,
- meaningful `staleTime`,
- careful invalidation after mutations,
- and avoiding route-level server orchestration for data the client can already own.

### 5. Minimize code growth

Do not solve this by building a new framework inside the app.

The preferred implementation style is:

- reuse existing view components,
- export skeletons from the same component module when appropriate,
- add `loading.tsx` beside route folders,
- and introduce new client container components only when a route family truly needs them.

---

## Route-by-route plan

## Phase 0: measurement first

Before more behavior changes, capture a baseline for:

- `/`
- `/repo/[owner]/[repo]`
- `/repo/[owner]/[repo]/pull/[number]`
- `/repo/[owner]/[repo]/pulls`
- `/repo/[owner]/[repo]/blob/[...path]`
- `/repo/[owner]/[repo]/tree/[...path]`

For each route, run one authenticated inspection flow:

1. `pnpm --filter web run browser -- open http://localhost:3000`
2. log in in the persistent Playwright browser if the session is not already warm
3. export the current auth cookies to a JSON file for `next-browser`
4. `pnpm --filter web run inspect -- open <url> --cookies-json <file>`
5. `pnpm --filter web run inspect -- ppr lock`
6. `pnpm --filter web run inspect -- ssr lock`
7. `pnpm --filter web run inspect -- goto <url>`
8. `pnpm --filter web run inspect -- screenshot`
9. `pnpm --filter web run inspect -- ssr unlock`
10. `pnpm --filter web run inspect -- ppr unlock`
11. `pnpm --filter web run inspect -- network`

This keeps the inspection browser authenticated without depending on `next-browser` to persist its own profile.

We want answers to:

- Is the shell visually non-empty?
- Which regions are still dynamic holes?
- Which fetches happen on route navigation?
- Which fetches happen only after the route shell is mounted?

## Phase 1: segment-level loading UI

Add `loading.tsx` to the dynamic route families and reuse the existing real skeleton components.

Proposed files:

- `apps/web/src/app/(protected)/repo/[owner]/[repo]/loading.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/pull/[number]/loading.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/pulls/loading.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/blob/[...path]/loading.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/tree/[...path]/loading.tsx`

Rules:

- use the same skeleton component the route uses locally,
- make the skeleton preserve layout, spacing, and major affordances,
- do not fetch data in `loading.tsx`,
- keep it route-shaped, not abstract.

Expected outcome:

- faster-feeling dynamic navigation,
- partial prefetch on dynamic routes,
- less “dead click” time before the user sees a response.

## Phase 2: normalize the top-level route boundary

### Inbox

Keep the current model. It is already close to the desired shape:

- server: onboarding check only,
- client: inbox data,
- shell: inbox skeleton.

Possible follow-up:

- consider whether `settings.getInboxSectionOrder` should get a longer `staleTime`,
- and evaluate whether the top bar summary query should use a slightly longer cache window.

### PR detail

Keep the current architecture and refine it:

- route stays shell-first,
- top-level PR query stays client-owned,
- nested panels remain Suspense islands.

Potential refinement:

- consider a small route-intent prefetch for the PR page query from inbox rows,
- but only if it measurably reduces perceived wait without reintroducing server orchestration.

### Repo browser / tree / blob / pulls

These are the next real targets.

Current issue:

- each page still fetches its main data in the server route component,
- so each navigation still pays server render cost before the page content is ready.

Plan:

1. keep auth / params / redirect logic in the server route,
2. move the main screen data into the existing client view family,
3. keep the frame static,
4. let the route-level skeleton carry the initial transition,
5. let the client cache own subsequent reuse.

Concretely:

- `RepoBrowserView` should become the owner of tree + branches query data,
- `FileBrowserView` should become the owner of file + branches query data,
- `PullRequestListView` should become the owner of repository pulls query data,
- the route page should stop awaiting those large reads directly.

This is the smallest coherent fix. It keeps the existing UI components and only changes where the data is owned.

## Phase 3: tune hydration and refetch behavior

Once route ownership is correct, tune the cache policy to reduce friction.

Audit every top-level route query for:

- `staleTime`
- `refetchOnWindowFocus`
- `refetchOnReconnect`
- `refetchOnMount`

Default principle:

- highly interactive GitHub route data should not feel like it “refetches every render,”
- especially when the user is moving back and forth within a short session.

Likely direction:

- longer `staleTime` for top-level route data,
- disable overly aggressive focus-driven refetch on heavy GitHub screens where freshness is less important than continuity,
- keep mutation-driven invalidation as the main freshness mechanism.

Do this deliberately, query by query, not as a blanket repo-wide change.

## Phase 4: tighten nested islands

After the top-level route data is fixed, audit the nested islands.

Questions per island:

- does this region need to block first paint?
- can its title / frame render statically before its data?
- is the fallback structurally correct?
- is it truly independent from neighboring regions?

Priority islands:

- PR diff
- PR discussion
- PR checks
- PR stack
- repo list secondary metadata
- file metadata that is not needed for the first painted frame

Expected outcome:

- page frame appears immediately,
- top-level content becomes interactive sooner,
- lower-priority or slower panels stream in later without layout collapse.

---

## Specific implementation strategy

### 1. Export route skeletons from the owning view component

Prefer this pattern:

- `PullRequestView` exports `PullRequestSkeleton`
- `RepoBrowserView` exports `RepoBrowserSkeleton`
- `FileBrowserView` exports `FileBrowserSkeleton`
- `PullRequestListView` exports `PullRequestListSkeleton`

Why:

- one source of truth for the route frame,
- `loading.tsx` and local fallbacks can share the same UI,
- less drift between transition state and in-route loading state.

### 2. Introduce one client container per route family only if needed

If a route family becomes awkward with data logic mixed into the presentational view, add one thin client container:

- `RepoBrowserRoute`
- `FileBrowserRoute`
- `RepoPullsRoute`

But do not create a general boundary framework.

Each container should:

- derive params from props,
- run 1-2 top-level queries,
- return a route-shaped skeleton if data is missing,
- hand real data to the existing presentational view.

### 3. Keep server-only reads server-only

Keep using server logic for:

- auth redirect checks,
- invalid param rejection,
- and truly server-only reads that do not belong in the client cache.

Do not move those to the client for symmetry.

### 4. Use prefetch where it has clear upside

Allowed uses:

- hover / viewport / intent prefetch for likely next screens,
- tiny metadata prefetch that sharpens the shell,
- prefetching a nested query that would otherwise cause an obvious secondary spinner.

Avoid:

- server-prefetching the whole route payload just because the page contains client queries,
- broad fan-out prefetch in the route component,
- hydrating data the user may never need above the fold.

---

## Success criteria

We should consider this plan successful when all of these are true:

1. `next-browser ppr lock` + `ssr lock` + `goto` on an authenticated session produces a visibly non-empty shell for the main protected routes.
2. Clicking a dynamic route link shows immediate, route-shaped UI rather than a dead pause.
3. The top-level route frame does not wait on GitHub-heavy reads.
4. Revisiting a route within its cache window reuses the browser cache rather than looking cold.
5. Heavy secondary panels still stream progressively.
6. The implementation does not sprawl across dozens of helper files.

---

## Validation checklist

### PPR

- verify the shell is non-empty for inbox, repo, tree, blob, pulls, and PR detail
- verify that static chrome sits outside dynamic holes
- verify that nested boundaries match actual slow regions

### Playwright auth bootstrap

Use Playwright with persistent profile to prepare the authenticated state for inspection:
- log in once on the protected app
- export the current auth cookies in the JSON shape that `next-browser --cookies-json` accepts
- refresh the cookie file whenever the session expires

### Navigation

- click from inbox to PR detail
- click from repo tree to blob and back
- switch branches
- move between pulls list and PR detail

Check:

- whether `loading.tsx` appears immediately,
- whether the screen frame is stable,
- whether the browser cache suppresses redundant refetch inside `staleTime`.

### Network

For each key route, distinguish:

- `_rsc` route payload fetches,
- top-level client route-data queries,
- nested panel queries,
- mutation-triggered invalidations.

The goal is not zero requests. The goal is:

- no unnecessary server-side route orchestration,
- and no extra client waterfall before the shell appears.

---

## Recommended rollout order

1. add `loading.tsx` to all dynamic route families using existing skeletons
2. export skeletons from the owning view modules where needed
3. convert repo browser route to client-owned top-level data
4. convert tree route to the same model
5. convert blob route to the same model
6. convert pulls route to the same model
7. tune cache / refetch policy for heavy GitHub queries
8. rerun the Playwright cookie-bootstrap step plus the authenticated `next-browser` PPR + network audit

This ordering gives the highest UX gain earliest while keeping the code delta contained.

---

## Out of scope

This plan is intentionally not:

- a full offline cache plan,
- a durable browser persistence plan,
- a Git sync engine plan,
- or a generalized client-side model layer.

Those are valid future directions, but they are bigger than the current problem.

The current problem is simpler:

we need better route boundaries, better segment loading UI, and better ownership of interactive route data so the app feels warm and static first.

