# Graphite-style inbox navigation plan

## Goal
Make inbox navigation behave like a persistent cached index:
- `/` owns the inbox view
- clicking a PR from inbox does not tear down the inbox list
- sidebar Inbox and browser Back return to the already-mounted inbox state
- section chrome stays present
- only section bodies and PR detail suspend

## What research showed
Graphite is still a Next app at the document layer, but its authenticated inbox/PR experience behaves like a client-owned SPA surface after the first load.

Observed with Proxyman:
- initial document load is Next/App Router
- inbox data comes from client API calls like:
  - `GET /api/v1/graphite/sections`
  - `GET /api/v1/graphite/section/prs?...`
- PR detail comes from client API calls like:
  - `GET /api/v1/graphite/pr-stack/...`
  - `GET /api/v1/graphite/github-pr/.../pull-request-diff?...`
- inbox data keeps revalidating with `If-None-Match` + `304 Not Modified`
- I did not observe follow-up document or RSC route fetches during inbox -> PR -> back interaction

Conclusion: Graphite keeps inbox client-owned and long-lived. It does not rely on re-entering `/` as a fresh page leaf.

## Root problem in our app
Today, these two routes are peers under the protected layout:
- `src/app/(protected)/page.tsx` -> inbox
- `src/app/(protected)/repo/[owner]/[repo]/pull/[number]/page.tsx` -> PR detail

That means selecting a PR swaps the `children` under `AppShell`.

So even with warm query cache:
- inbox unmounts on PR open
- inbox remounts on return
- the sidebar warmup logic only hides the teardown cost

The architectural fix is to stop treating PR selection from inbox as a page replacement.

## Simple design decision
From inbox, a PR should be **selected state**, not a new page leaf.

That means:
- inbox remains mounted
- PR detail renders inside the inbox surface
- back/inbox clears selection instead of remounting `/`

## Scope for the first implementation
Keep this narrow.

Do not solve the whole app.
Do not redesign all routing.
Do not chase perfect canonical URLs in phase 1.

Only solve:
- root inbox page
- section rendering
- PR selection from inbox
- sidebar Inbox return
- browser Back return

## Recommended implementation

### 1. Make `/` the long-lived inbox owner
File:
- `apps/web/src/app/(protected)/page.tsx`

Change `/` from a thin wrapper around `InboxRoute` into the inbox workspace owner.

It should render:
- inbox shell
- inbox sections/list
- selected PR detail pane or overlay

This component becomes the stable owner for the whole inbox review session.

### 2. Keep section chrome always rendered
Files:
- `apps/web/src/app/(protected)/_components/inbox-route.tsx`
- possibly split new section-level components

Render predefined section headers immediately from known section definitions or cached section metadata.

Then put each section body behind its own suspense/query boundary.

Desired result:
- section names and layout do not disappear
- only the rows inside a section suspend
- returning from PR does not make the whole inbox feel cold

### 3. Move PR selection into client state under `/`
Files:
- `apps/web/src/app/(protected)/page.tsx`
- `apps/web/src/app/(protected)/_components/inbox-route.tsx`
- likely a new inbox detail host component

Use URL state under `/` for the selected PR, for example search params:
- `/`
- `/?pr=Itsnotaka/sachi/9`

or separate params like owner/repo/number.

Behavior:
- clicking a PR row updates selection state and URL state
- inbox list stays mounted
- PR detail opens in a pane or overlay within the inbox workspace
- closing detail removes the selection state

This gives SPA behavior without leaf replacement.

### 4. Treat browser Back and sidebar Inbox as selection reset
Files:
- `apps/web/src/app/(protected)/app-shell.tsx`
- inbox workspace owner

Behavior:
- if a PR is selected inside `/`, sidebar Inbox clears selection instead of navigating to a new page tree
- browser Back moves from selected PR state back to plain inbox state
- if already at plain inbox state, sidebar Inbox is a no-op

This is the key behavior Graphite-like UX depends on.

### 5. Keep PR detail query ownership separate from inbox ownership
Files:
- new detail host under inbox workspace
- existing PR data/query code reused where possible

Reuse existing PR query components where possible, but mount them inside the inbox workspace instead of through the standalone PR route.

The inbox owns:
- section queries
- scroll position
- expanded/collapsed state
- current list DOM

The detail pane owns:
- selected PR queries
- PR-local loading states

### 6. Leave the standalone PR route in place, but stop using it for inbox-origin navigation
Files:
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/pull/[number]/page.tsx`
- inbox link/click handlers

Keep the direct PR route for:
- pasted URLs
- hard reloads
- external navigation

But when the user starts in inbox, do not navigate into that page leaf.

That route remains a direct-entry page, not the primary inbox review flow.

## Why this is the simplest correct first step
This avoids the hardest part of App Router up front.

We do **not** need to begin with:
- parallel routes
- intercepting routes
- modal route conventions
- route-level layout surgery

Those may be worth doing later if canonical PR paths during inbox review matter.

But the narrowest path to Graphite behavior is simpler:
- keep inbox mounted at `/`
- use URL state for selected PR
- render detail inside the inbox workspace

## File plan

### Phase 1: make `/` the workspace owner
Touch:
- `apps/web/src/app/(protected)/page.tsx`
- `apps/web/src/app/(protected)/_components/inbox-route.tsx`

Tasks:
- move from page-level suspense wrapper to inbox workspace owner
- keep inbox mounted while detail changes
- split section shell from section body suspense if needed

### Phase 2: add selected-PR state under `/`
Touch:
- `apps/web/src/app/(protected)/page.tsx`
- `apps/web/src/app/(protected)/_components/inbox-route.tsx`
- new inbox detail host component

Tasks:
- add search-param driven PR selection
- open detail inside inbox workspace
- close detail by clearing selection

### Phase 3: simplify sidebar behavior
Touch:
- `apps/web/src/app/(protected)/app-shell.tsx`

Tasks:
- make Inbox click clear selection when inbox workspace is active
- stop relying on sidebar-triggered warmup as the primary UX fix
- keep prefetch only as optimization if still useful

### Phase 4: preserve direct-entry PR page
Touch:
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/pull/[number]/page.tsx`

Tasks:
- keep standalone PR route working for direct navigation
- avoid coupling inbox-origin UX to this page leaf

## Acceptance criteria
The change is done when all of these are true:
1. From `/`, clicking a PR does not unmount the inbox list.
2. Section chrome remains present throughout the interaction.
3. Browser Back from selected PR state returns to the already-mounted inbox.
4. Sidebar Inbox from selected PR state returns to the already-mounted inbox.
5. Returning from PR does not re-show a whole-page inbox suspense state.
6. Direct navigation to `/repo/:owner/:repo/pull/:number` still works.

## Verification plan
Use the same workflow as before, but now expect stronger behavior than warm cache:
1. open `/`
2. wait for inbox rows
3. click a PR
4. verify inbox DOM is still present behind/beside detail if the UI pattern exposes it
5. use browser Back
6. verify:
   - no inbox remount feeling
   - no whole-page skeleton
   - prior scroll/expanded state survives
7. use sidebar Inbox
8. verify the same behavior

## Non-goals for this first pass
- perfect Graphite URL parity
- parallel routes for every protected screen
- solving every PR entry path the same way
- removing all existing query prefetching

## Follow-up only if needed
If later we decide the selected PR must use canonical `/repo/.../pull/...` URLs even during inbox review, then the next step is:
- migrate inbox review to App Router parallel or intercepting routes
- keep inbox in a persistent slot
- render PR detail into a sibling slot

But that is phase 2 architecture. It is not required for the first correct fix.
