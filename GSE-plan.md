# GSE plan

## Executive judgment

Short answer: yes, we can get much closer to the Linear/Graphite feel, but not by treating TanStack Query persistence as the whole solution.

If we want:

- first load to be fast,
- branch and stack switches to feel instant after the first load,
- PR pages to reuse already-known data instead of re-fetching everything,
- and eventually survive reloads / reconnects without feeling cold,

then we need a real sync architecture.

The core idea is:

1. keep GitHub and git as the source inputs,
2. build our own projected cache over them,
3. persist that projection on the server with Drizzle/Postgres,
4. persist the hot subset again in the browser with IndexedDB,
5. stream deltas instead of repeatedly rebuilding screens from raw GitHub requests.

TanStack Query, Zustand, Next.js, and the Effect v4 GitHub service are all useful here, but they are not the sync engine by themselves.

My opinionated take:

- `@sachikit/github` + Effect is a good source adapter and mutation executor.
- Drizzle/Postgres is a good canonical server cache / projection store.
- TanStack Query is a good view cache and hydration shell.
- Zustand should remain UI state, not become our database.
- For true “instant after first load”, we still need a browser-local durable store. Server-side Postgres alone is not enough.

I would call the target architecture **GSE: Git Sync Engine**.

---

## Why the Linear write-up matters

The reverse-engineered Linear write-up is useful because it is not “use MobX and cache more.” It is a description of a system with five important properties:

1. **A model registry**
   - the client knows what entities exist,
   - how they load,
   - how they reference each other,
   - and how schema changes bust persistence safely.

2. **A real local database**
   - not just in-memory React state,
   - not just a fetch cache,
   - but a durable local projection that survives reloads.

3. **Lazy hydration with indexes**
   - boot only what is needed,
   - then hydrate heavy relations on demand,
   - using known lookup keys instead of ad hoc fetches.

4. **Transactions / optimistic writes**
   - local state updates immediately,
   - the write is queued durably,
   - the server confirms or rejects,
   - and the client can rollback or rebase.

5. **Delta packets with a monotonic sync id**
   - after bootstrapping, the client does not keep re-fetching whole screens,
   - it applies ordered changes,
   - detects gaps,
   - and can recover with partial or full bootstrap.

That is the real lesson.

The lesson is not “MobX”. MobX was just one implementation tool for identity + reactivity.

---

## What we have today in Sachi

### 1. Client cache: TanStack Query is present, but only as an in-memory query cache

Relevant files:

- `apps/web/src/components/providers.tsx`
- `apps/web/src/lib/trpc/query-client.ts`
- `apps/web/src/lib/trpc/server.tsx`

Current state:

- one browser `QueryClient` is created in `providers.tsx`,
- server components prefetch queries and hand them to `HydrateClient`,
- query defaults are only `staleTime: 30 * 1000`,
- there is no persistence plugin,
- there is no IndexedDB / Dexie / idb / localforage / sqlite layer in the repo.

Implication:

- we get good request dedupe and RSC hydration,
- but a hard refresh still throws away the client cache,
- and there is no durable local projection after reload.

Important detail from TanStack’s own persistence guidance:

- persistence is viable,
- but `gcTime` must be increased to match `maxAge`,
- otherwise the restored cache gets garbage-collected too quickly.

Right now we do not even have persistence wired up, and our defaults are far from a durable cache profile.

Concrete evidence from the cache audit:

- the browser `QueryClient` is a memory-only singleton in `providers.tsx`, so back/forward can feel instant within one live session but a reload empties the cache entirely,
- the server `QueryClient` in `server.tsx` is only deduped per request via `cache(createQueryClient)`, so SSR still cold-starts on each new request,
- the Zustand repo store in `repo-context.tsx` uses plain `create()` with no persist middleware, so repo metadata is also dropped on reload,
- mutations have no durable outbox, so a tab close during a transient failure can lose in-flight client intent,
- and the current cache policy is only `staleTime: 30 * 1000` plus default TanStack Query garbage collection, which is far too weak for Linear-style warm reloads.

### 2. Zustand exists, but only for tiny UI-ish state

Relevant file:

- `apps/web/src/app/(protected)/_components/repo-context.tsx`

Current state:

- Zustand stores only `repos`, `totalSynced`, and `setRepoData`.

Implication:

- this is nowhere near an object pool, normalized entity graph, or sync layer,
- which is good: we should not try to turn this store into one.

### 3. The app is still request/response oriented

Relevant files:

- `apps/web/src/app/(protected)/page.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/page.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/tree/[...path]/page.tsx`
- `apps/web/src/app/(protected)/repo/[owner]/[repo]/pull/[number]/page.tsx`
- `apps/web/src/app/(protected)/repo/_components/repo-browser-view.tsx`

Current state:

- server components fetch data on navigation,
- they prefetch TanStack queries for hydration,
- branch switches in `RepoBrowserView` call `router.push(...)`, which sends the user through another route load,
- tree pages call `getRepoTree(...)` and `getRepoBranches(...)` on each route load.

Implication:

- current warm navigation is “server fetch + hydrate faster than cold”,
- not “render locally from a durable repo projection”.

For branch switching specifically, we are currently doing the expensive version of the problem.

Concrete evidence from the GitHub data-flow audit:

- the dominant pattern is `caller.github.*` for initial server reads followed by `prefetch()` into hydrated TanStack Query state, which means the app is still built around request/response orchestration rather than a replicated local model,
- the pull request route fans out especially hard: it does an initial `caller.github.getPullRequestPage(...)` and then prefetches the PR page, discussion, files, review comments, stack, check summary, diff settings, and viewed files before render,
- `React.cache()` is used in `catalog.ts`, `auth.ts`, `inbox.ts`, and `context.ts` for functions like `getOnboardingState`, `loadInboxData`, `findRepoContext`, and `getGitHubAccessToken`, but that dedupe lives only for a single RSC render and does not create durable state,
- `loadInboxData()` still fetches recent PRs from GitHub on each load and has no watermark, `snapshot_id`, or delta protocol, so every inbox refresh effectively rebuilds the world again,
- GitHub mutations still refresh the UI mainly through manual `queryClient.invalidateQueries(...)` in files like `pull-request-view.tsx`, `label-panel.tsx`, `reviewer-panel.tsx`, and `diff-section.tsx`, mostly at route-query granularity rather than entity granularity,
- and the only optimistic client updates today are for local app data such as viewed files and diff settings, not for GitHub-backed entities like PRs, labels, reviewers, or comments.

### 4. Stack loading is still derived live from GitHub, not from a local graph

Relevant file:

- `apps/web/src/lib/github/stack.ts`

Current state:

- `getPullRequestStack(...)` calls `listRepositoryPullRequests(..., "all")`,
- then derives the chain by matching `head.ref` and `base.ref` in memory.

Implication:

- stack navigation cannot become Graphite-fast if every stack view starts by listing all PRs again,
- we need a persisted `stack_edge` / branch graph projection.

### 5. The Effect GitHub service is a strong foundation, but it is not the model layer

Relevant files:

- `apps/web/src/lib/github/effect.ts`
- `packages/github/src/client.ts`
- `packages/github/src/services.ts`

Current state:

- the GitHub package gives us typed Effect services over Octokit,
- the app wraps them with telemetry and helper runners,
- this is already a clean boundary for reads/writes against GitHub.

Implication:

- this is the right place to keep source adapters,
- but it is closer to Linear’s transport / service boundary than to its MobX object model.

In other words:

- **Effect service = source adapter / executor**
- **not** object pool,
- **not** local database,
- **not** delta applier.

### 6. We do have a database, but it is server-side persistence, not a browser-local sync store

Relevant files:

- `packages/db/src/client.ts`
- `packages/db/src/schema/synced-repos.ts`
- `packages/db/src/schema/settings.ts`
- `packages/db/src/schema/pr-files.ts`
- `apps/web/src/lib/trpc/routers/repo-sync.ts`
- `apps/web/src/lib/trpc/routers/settings.ts`

Current state:

Drizzle/Postgres is already used for:

- synced repo selection,
- diff settings,
- inbox section order,
- viewed files,
- auth/session data.

What it is **not** used for today:

- a mirrored GitHub PR model,
- a branch / commit / tree projection,
- a delta log,
- a mutation outbox,
- repo cursors / sync ids,
- or a durable bootstrap snapshot.

Implication:

- the existing DB is valuable and should absolutely be part of the design,
- but it currently stores user settings and small app state, not the Git working model.

### 7. Realtime / delta transport does not exist yet

Current state:

- no WebSocket layer,
- no SSE layer,
- no delta packet table,
- no `snapshot_id` / cursor model,
- no background sync protocol.

Implication:

- every page still behaves like a fresh request flow,
- not like a replicated local projection.

### 8. Some current helper patterns are fine for UI, but unsafe for a sync engine

Relevant files:

- `apps/web/src/lib/github/effect.ts`
- `apps/web/src/lib/github/repository.ts`
- `apps/web/src/lib/github/stack.ts`

Current state:

- `runGitHubEffectOrNull(...)` and `runGitHubEffectOrEmptyArray(...)` intentionally flatten failures into plausible values.

Implication:

- that is acceptable for some current screens,
- but it is dangerous in a projector / sync system.

A sync engine must distinguish:

- “there is no data”,
- “we are not authorized”,
- “GitHub failed”,
- “webhook lagged”,
- “cursor is stale”,
- “projection is incomplete”.

If we blur those into `null` or `[]`, we will eventually tell lies to the rest of the system.

---

## The important mapping: Linear concepts vs Sachi concepts

| Linear concept                   | What we have today                         | What GSE should become                                                      |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `ModelRegistry`                  | scattered TS types, Zod inputs, query keys | explicit entity registry + schema hash + partial index rules                |
| Object Pool                      | none                                       | normalized in-memory entity map keyed by repo/entity ids                    |
| IndexedDB stores                 | none                                       | browser IndexedDB store for repo/PR/cache state                             |
| Partial indexes                  | ad hoc route params / query inputs         | explicit lookup keys like `repo+ref`, `repo+pull`, `repo+head_sha`          |
| Full / partial / local bootstrap | RSC fetch + hydrate only                   | full bootstrap, local bootstrap from IndexedDB, partial hydration on demand |
| Transactions                     | direct mutate then invalidate              | durable optimistic outbox with rollback / dedupe                            |
| Delta packets                    | none                                       | ordered per-repo deltas over SSE / WebSocket                                |
| `lastSyncId`                     | none                                       | per-repo `snapshot_id` / cursor                                             |
| Sync groups                      | synced repo selection only                 | subscription set of synced repos / installation scopes                      |

---

## Opinionated architecture: what GSE should actually be

## 1. Use two durable layers, not one

We need both:

### A. Server-side canonical projection

Backed by:

- Drizzle + Postgres for normalized state and sync metadata,
- a repo mirror for git-native data.

Why:

- GitHub is too slow and too request-oriented to power Graphite-like navigation directly,
- git trees, commit graphs, branch heads, and diffs are much cheaper if we own a mirror,
- Postgres is the right place for user-scoped and normalized projections.

### B. Browser-side local projection

Backed by:

- IndexedDB,
- plus a thin in-memory identity map / object pool,
- with TanStack Query sitting above it.

Why:

- server-side Postgres only gets us faster network responses,
- it does not make reloads or intra-session transitions truly local,
- it does not give offline tolerance,
- and it does not let us rehydrate instantly before the next request resolves.

This is the same fundamental trick Linear uses: durable local state plus ordered synchronization.

---

## 2. Split the problem into immutable git data and mutable GitHub collaboration data

This is the biggest architectural simplification available to us.

### Immutable / mostly immutable side

Best sourced from a bare git mirror:

- refs / branch heads,
- commit graph,
- tree entries,
- blob metadata,
- diff inputs (`base_sha`, `head_sha`),
- merge-base style comparisons,
- branch ancestry for stacks.

### Mutable collaboration side

Best sourced from GitHub API + webhooks:

- pull request title/body/state,
- labels,
- reviewers,
- issue comments,
- reviews,
- checks / statuses,
- merge state,
- installation / permission changes.

Why this matters:

- git data has very different access patterns and storage characteristics,
- if we try to model everything as “GitHub API cache rows”, branch and stack performance will stay mediocre,
- if we try to put every tree/blob/diff into Postgres eagerly, we will create an expensive storage problem.

So the right split is:

- **git mirror = source of repository graph truth**
- **Postgres = normalized collaboration projection + sync protocol metadata**
- **browser IndexedDB = user-local hot subset**

---

## 3. The Effect layer should sit under GSE, not be GSE

Recommended layering:

1. `packages/github`
   - source adapters to GitHub / Octokit,
   - typed mutation executor,
   - retries / telemetry / rate-limit handling.

2. new `packages/gse` or `packages/sync`
   - entity schemas,
   - bootstrap protocol,
   - delta packet codec,
   - transaction types,
   - partial index definitions,
   - server projector logic.

3. `apps/web/src/lib/gse`
   - browser IndexedDB store,
   - object pool / live registry,
   - delta applier,
   - client bootstrap,
   - transaction outbox.

4. UI
   - TanStack Query selectors over GSE,
   - Zustand for UI-only state.

That keeps one concept in one place.

---

## 4. We should not copy Linear literally

We should copy the **capabilities**, not the exact shape.

I would **not** try to recreate:

- MobX as a hard dependency,
- one global sync id across the whole product,
- fully generic decorator-driven ORM magic on day one.

I **would** recreate:

- schema/version hashing,
- explicit entity registry,
- local bootstrap vs partial hydration,
- durable optimistic outbox,
- ordered per-repo deltas,
- gap detection and rebootstrap,
- normalized identities.

Because our domain is repo-local much more often than workspace-global, I would use:

- **per-repo monotonic `snapshot_id`**, not a single global one.

That gives us:

- simpler cursors,
- simpler resync,
- cleaner multi-repo subscriptions,
- better isolation.

---

## GSE target architecture

## A. Server-side projection model

### Core idea

Treat GitHub + git mirror as upstream inputs, and materialize a **Sachi-owned read model**.

### Likely core tables

This is illustrative, not final, but the shape should look roughly like this:

- `repo_sync_state`
  - `repo_id`
  - `installation_id`
  - `last_snapshot_id`
  - `last_webhook_at`
  - `last_reconcile_at`
  - `schema_version`

- `git_ref`
  - `repo_id`
  - `ref_name`
  - `target_oid`
  - `updated_at`

- `git_commit`
  - `repo_id`
  - `oid`
  - `parent_oids`
  - `author_name`
  - `authored_at`
  - `title`

- `pull_request_state`
  - `repo_id`
  - `pull_number`
  - `head_ref`
  - `head_sha`
  - `base_ref`
  - `base_sha`
  - `state`
  - `merged`
  - `title`
  - `body`
  - `updated_at`

- `pull_request_review_state`
- `pull_request_comment_state`
- `pull_request_label_state`
- `check_summary_state`
- `stack_edge`
  - materialized parent/child PR relationships

- `delta_action`
  - `repo_id`
  - `snapshot_id`
  - `entity_kind`
  - `entity_id`
  - `action`
  - `payload`
  - `created_at`

- `client_cursor`
  - `user_id`
  - `repo_id`
  - `last_seen_snapshot_id`
  - `schema_hash`

- `mutation_dedupe`
  - `tx_id`
  - `repo_id`
  - `status`
  - `result_snapshot_id`

We should keep git-heavy artifacts out of Postgres unless they are compact and frequently queried. Trees and large diff payloads are better as:

- lazy materialized caches,
- or git mirror reads with a thin memoized index.

### Important design choice

Do **not** store raw GitHub JSON as the canonical shape.

Instead:

- define first-class entities for what the app actually renders,
- preserve enough source metadata to reconcile,
- but keep the read model stable even if GitHub response shapes drift.

---

## B. Browser-side local model

### Use IndexedDB, not just persisted query cache

For small view caches, persisted TanStack Query is enough.
For repo / PR / branch / stack state, it is not.

Why:

- query cache is keyed by screens, not by identity,
- it duplicates entities across pages,
- it is weak at delta application,
- it is weak at object identity,
- and it becomes awkward once one change must update inbox + PR page + stack + repo list.

Recommended browser model:

- IndexedDB via Dexie or a thin idb layer,
- normalized tables keyed by entity identity,
- in-memory object pool for hot entities,
- query selectors that read slices from that local model.

### What TanStack Query should do in GSE

Keep TanStack Query, but reposition it:

- use it for bootstrap requests,
- use it for delta polling / stream lifecycle,
- use it for derived selectors and view composition,
- persist light query results where it helps,
- but stop treating it as the only repository of product state.

### What Zustand should do in GSE

Keep Zustand for UI-local concerns, for example:

- active file,
- sidebar open/closed,
- filter chips,
- local drafting state,
- scroll anchors.

Do **not** use it as the long-term canonical graph store.

---

## C. Partial hydration for our domain

Linear uses partial indexes to know what to load lazily.
We need the same idea, but with git / PR-specific lookup keys.

Our likely partial indexes are:

- `repo_id`
- `repo_id + ref_name`
- `repo_id + pull_number`
- `repo_id + head_sha`
- `repo_id + base_sha + head_sha`
- `repo_id + path + ref_name`
- `repo_id + reviewer_login`
- `repo_id + check_ref`

Examples:

- inbox bootstraps `pull_request_state`, `check_summary_state`, and `stack_edge` for synced repos,
- PR page lazily hydrates `discussion`, `review_comments`, and `file_diffs`,
- repo browser bootstraps the active branch manifest and lazily hydrates deeper trees / blobs,
- stack view reads `stack_edge` locally and only loads missing PR details.

This is how we get the “first load fetches enough, then navigation becomes cheap” behavior.

---

## D. Bootstrapping model

We should adopt the same three bootstrap modes conceptually.

### 1. Full bootstrap

Used when:

- first visit,
- local browser DB missing,
- schema hash changed,
- cursor gap too large,
- repo newly synced.

Returns:

- repo manifest,
- selected refs,
- PR summaries,
- stack edges,
- user-scoped settings,
- latest `snapshot_id`.

### 2. Local bootstrap

Used when:

- local browser DB exists,
- schema is compatible,
- repo has a known cursor.

Flow:

1. load local IndexedDB immediately,
2. render from it,
3. request deltas after the stored `snapshot_id`,
4. apply them in the background.

This is the critical path for “instant after first load”.

### 3. Partial bootstrap

Used when:

- the user opens a branch, tree, blob, PR discussion, or diff not already local.

Flow:

- fetch the missing slice only,
- store it durably,
- index it by its lookup key.

---

## E. Transactions and optimistic writes

If we want Linear-like feel, mutations must stop being “mutate then invalidate and wait.”

Today many flows still do:

- perform mutation,
- invalidate page queries,
- refetch.

That is correct enough for a request/response app, but not for a sync engine.

### Target mutation flow

1. user action creates a transaction with a client `tx_id`,
2. client writes the optimistic change to local IndexedDB + object pool immediately,
3. transaction is persisted in a browser outbox,
4. server receives `tx_id` and dedupes it,
5. server executes against GitHub,
6. server reconciles its projection,
7. server emits authoritative delta packet(s),
8. client marks the transaction complete when the matching or superseding `snapshot_id` arrives,
9. if rejected, client rolls back or applies server truth.

### Important adaptation for GitHub

GitHub does not give us Linear’s native delta stream.

So our authoritative flow must be:

- GitHub mutation response,
- plus webhook / reconcile update,
- turned into **our own** delta log.

### Important hardening decision

We should not repeat the write-up’s “replayed non-idempotent transaction may double-apply” weakness.

We should give each mutation a stable `tx_id` and dedupe it server-side.

---

## F. Delta packets

This is the real backbone.

### Proposed packet model

Per repo:

- `snapshot_id` increases monotonically,
- each applied projection change writes one or more `delta_action` rows,
- clients subscribe only to synced repos,
- packets are delivered over SSE first, WebSocket later if needed.

Why SSE first:

- much simpler operationally,
- enough for ordered server-to-client deltas,
- easier to add to Next environments than full bidirectional socket semantics.

### Client delta apply flow

1. receive packet,
2. verify packet is contiguous with local `snapshot_id`,
3. write actions to IndexedDB,
4. update in-memory object pool,
5. update query selectors / `setQueryData` where useful,
6. advance cursor.

If a gap is detected:

- fetch missing deltas,
- or force partial/full bootstrap.

That is our equivalent of Linear’s “missed packets => recover from cursor”.

---

## G. How this gets us instant branch and stack switching

This is the part that matters most for the UX you are asking for.

### Branch switching

Current path:

- branch selector -> `router.push` -> server route -> GitHub fetch -> render.

Target path:

- branch selector -> local manifest lookup in IndexedDB -> immediate render if present,
- background fetch only if local data is stale or missing,
- branch heads update through deltas.

What must be local for this to feel instant:

- branch list,
- branch head sha,
- tree manifest for recently used refs,
- recent PR linkage for that ref,
- cached commit summary.

### Stack switching

Current path:

- derive stack by listing all PRs repeatedly.

Target path:

- read `stack_edge` graph locally,
- read cached PR summaries locally,
- prefetch adjacent stack items after first stack open,
- hydrate heavy details lazily.

### Diff and file navigation

Do not try to make the entire diff universe instant on day one.

Instead:

- make file lists and metadata instant,
- make viewed/unviewed state instant,
- cache first page / active file diffs aggressively,
- prefetch neighboring files,
- store large patch payloads lazily.

That is the same spirit as partial hydration.

---

## Implementation plan

## Phase 0 — Measure the real baseline

Goal:

- know where current latency comes from before building the new system.

Work:

- instrument route load times for inbox, repo page, tree page, PR page,
- count GitHub API calls per screen,
- measure branch-switch latency and stack-open latency,
- record cache hit/miss rates once persistence exists.

Success criteria:

- we can prove improvement later,
- we know which screens benefit most from GSE first.

## Phase 1 — Fastest practical win: persisted TanStack Query + cache discipline

Goal:

- get immediate user-visible wins before full GSE exists.

Work:

- add `PersistQueryClientProvider`,
- use an IndexedDB-backed persister, not localStorage,
- raise `gcTime` to align with persistence `maxAge`,
- define cache busting with a schema/version string,
- prefetch obvious next hops: adjacent stack items, current repo branches, next PR page after submit,
- stop cold-dropping useful hydrated data on refresh.

Important caveat:

- this is a warm-cache improvement,
- not the full sync engine.

Success criteria:

- hard refresh of recently visited screens paints from restored query cache,
- no correctness regressions,
- cache survives reloads.

## Phase 2 — Introduce a first-class server projection in Postgres

Goal:

- stop building inbox / stack / repo screens straight from live GitHub calls.

Work:

- add normalized projection tables via Drizzle,
- add repo sync cursors,
- ingest GitHub data into read models,
- materialize `stack_edge`, PR summaries, review state, check summaries,
- move inbox reads to the projection instead of rebuilding from GitHub on every request.

Important decision:

- the projection code must keep real failure states,
- no `orEmptyArray` / `orNull` flattening in projector pipelines.

Success criteria:

- inbox and stack reads come from Postgres projection,
- GitHub calls move to ingestion/reconcile paths instead of page render paths.

## Phase 3 — Add a repo mirror for git-native speed

Goal:

- make branch / tree / commit navigation fast enough to matter.

Work:

- maintain a bare mirror per synced repo,
- fetch refs incrementally,
- expose tree / blob / commit reads from the mirror,
- materialize cheap branch manifests keyed by `repo_id + ref_name`,
- precompute commonly used stack / ancestry data from the mirror rather than from repeated GitHub PR scans.

Important note:

- do not store the whole user working copy,
- store a shared repo mirror plus derived indexes.

Success criteria:

- branch switch no longer requires direct GitHub tree fetch on hot paths,
- stack ancestry reads avoid `listRepositoryPullRequests("all")` on render paths.

## Phase 4 — Build browser IndexedDB projection and object pool

Goal:

- make “local bootstrap” real.

Work:

- add browser IndexedDB schema for GSE entities,
- define entity registry + schema hash,
- implement local bootstrap,
- implement partial lookup indexes,
- hydrate critical entities into an in-memory object pool,
- wire TanStack Query selectors to local data first.

Success criteria:

- revisiting a repo / PR / stack after first load renders from local data before network,
- local DB survives reloads,
- the same PR identity is reused across inbox, stack, and PR page.

## Phase 5 — Add delta stream and cursors

Goal:

- replace coarse refetch with ordered incremental sync.

Work:

- add `snapshot_id` per repo,
- write `delta_action` rows on projection changes,
- expose delta feed endpoint (`after=snapshot_id`),
- start with SSE streaming,
- implement gap detection and recovery,
- apply deltas to IndexedDB first, then memory.

Success criteria:

- open tabs stay fresh without full-page refetch,
- reconnect catches up by cursor,
- missing deltas trigger controlled recovery.

## Phase 6 — Add optimistic transaction/outbox support for core mutations

Goal:

- make writes feel local-first.

Start with a narrow set:

- add / remove labels,
- add / remove reviewers,
- add comments,
- mark ready for review,
- maybe merge later.

Work:

- define client `tx_id`,
- persist outbox in browser IndexedDB,
- dedupe on the server,
- optimistically apply to local projection,
- reconcile on authoritative delta.

Success criteria:

- targeted mutations update UI immediately,
- reload during in-flight mutation does not lose intent,
- duplicate submit does not double-apply.

## Phase 7 — Move hot navigation off route-blocking fetches

Goal:

- convert the UX from “router navigation triggers fetch” to “router navigation reveals already-local data”.

Work:

- branch selector should read local branch manifest first,
- stack panel should read local `stack_edge` first,
- PR page should open from locally cached summary + lazily hydrate heavy panels,
- repo tree should read local manifest and fetch missing subtrees only when necessary.

Success criteria:

- branch and stack switching are effectively instant once bootstrapped,
- server work becomes refresh/reconcile, not every-navigation dependency.

---

## What we should not do

1. **Do not treat persisted TanStack Query as the final architecture.**
   - It is a good phase, not the destination.

2. **Do not turn Zustand into a fake ORM.**
   - UI store and domain store should stay separate.

3. **Do not store every heavy git artifact eagerly in Postgres.**
   - Use the mirror and lazy caches.

4. **Do not keep page-level invalidation as the long-term refresh model.**
   - Delta application must update identities directly.

5. **Do not flatten source failures into empty success-looking values in the projector.**
   - A sync engine has to tell the truth.

6. **Do not aim for all mutation types at once.**
   - Start with a small optimistic surface and harden it.

---

## Risks and tradeoffs

### 1. GitHub is not Linear

Linear owns both the mutation system and the delta stream.
We do not.

So our engine must cope with:

- webhook delay,
- webhook loss,
- GitHub eventual consistency,
- API rate limits,
- partial visibility by repo/install/user.

This is why the server projection and reconcile loop matter.

### 2. Storage growth

Trees, blobs, and diffs can explode.

Mitigation:

- cache manifests first,
- lazy-load deep trees / large diff payloads,
- expire cold local slices,
- keep the browser DB as a hot cache, not a full clone.

### 3. Correctness complexity

Transactions + deltas + optimistic writes can lie if the contracts are muddy.

Mitigation:

- explicit `tx_id`,
- explicit error states,
- explicit cursor tracking,
- schema-hash busting,
- one canonical entity per concept.

### 4. Operational complexity

A repo mirror and sync workers add moving parts.

Mitigation:

- phase them in,
- start with projection tables before full delta streaming,
- start with SSE before more elaborate transport.

---

## Recommended delivery order

If the goal is fastest meaningful improvement without losing the long-term design, my recommended order is:

1. **Phase 1** — persisted TanStack Query + cache policy cleanup
2. **Phase 2** — Postgres projection for inbox / stack / PR summaries
3. **Phase 3** — repo mirror for branch/tree/commit speed
4. **Phase 4** — browser IndexedDB projection + local bootstrap
5. **Phase 5** — delta feed
6. **Phase 6** — optimistic outbox for core writes
7. **Phase 7** — move hot branch/stack nav fully onto local-first reads

That order gets us:

- early wins quickly,
- then the real Graphite/Linear-style architecture,
- without pretending the first cache step solved the deeper problem.

---

## Concrete acceptance targets

I would consider GSE successful when all of these are true:

1. **First meaningful repo bootstrap** is served from our own projection, not a pile of live GitHub render-path calls.
2. **Warm reload of recently visited repo / PR / stack screens** paints from local browser storage before network completes.
3. **Branch switches after first load** render in under ~100ms when the branch manifest is already local.
4. **Stack switches after first load** do not require listing all PRs again.
5. **Open tabs stay fresh** through ordered deltas instead of page-level invalidation/refetch.
6. **Core optimistic writes** survive reload/reconnect and dedupe correctly.
7. **GitHub outages or rate limits** are represented as real sync states, not silently flattened into empty data.

---

## My final take

Yes, we can absolutely move in this direction.

But the real answer is not:

- “we already have TanStack Query, Zustand, Next.js, and Effect, so we’re basically there.”

The real answer is:

- “we already have several good pieces, and they are enough to build this correctly if we add the missing sync architecture.”

The most important missing pieces are:

- a server-owned projection,
- a git mirror,
- a browser-owned local store,
- ordered deltas,
- and a durable outbox.

If we only do aggressive caching, we will get a nicer request/response app.
If we do the full GSE shape, we can get much closer to the Linear / Graphite feel.

---

## References

- Reverse Engineering Linear’s Sync Engine: https://github.com/wzhudev/reverse-linear-sync-engine
- Summary: https://raw.githubusercontent.com/wzhudev/reverse-linear-sync-engine/refs/heads/main/SUMMARY.md
- TanStack Query persistence docs: https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient/
- Next.js caching docs: https://nextjs.org/docs/14/app/building-your-application/caching
- Ink & Switch local-first essay: https://www.inkandswitch.com/essay/local-first/
