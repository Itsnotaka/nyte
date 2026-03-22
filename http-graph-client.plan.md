# HTTP Batch vs GitHub Graph Plan

## Goal

Make inbox and pull request surfaces feel faster by separating two different problems:

1. Client-side head-of-line blocking from `httpBatchLink` when multiple high-variance GitHub queries start together.
2. Server-side GitHub fan-out where some read models still make many upstream REST calls per repo or per pull request.

The plan is to use `skipBatch` selectively for interactive inbox and PR queries, then evaluate targeted upstream GraphQL migrations where REST currently fans out too much.

## The Issue

### 1. Client batching can hide fast results behind slow ones

The compare page proved the transport issue clearly: if two client queries launch in the same turn and go through `httpBatchLink`, the fast one does not render as soon as it is ready. It waits for the batched HTTP response to complete.

That means the user-visible latency becomes "the slowest query in the batch," even when the underlying fast query finished earlier.

This is not the same thing as the GitHub API being slow. It is client transport head-of-line blocking.

The app now has a `splitLink` path for `skipBatch` in `apps/web/src/lib/trpc/react.tsx#L17-L40`, so we can opt specific queries out of batching without disabling batching globally.

### 2. Some GitHub read paths are still upstream REST fan-out

Even if client transport is fixed, some pages still spend too much time on the server because they do a lot of GitHub REST work.

The clearest inbox example is `loadInboxData()` in `apps/web/src/lib/github/inbox.ts#L303-L470`:

1. List recent PRs per synced repo.
2. For relevant open PRs, fetch reviews per PR.
3. For relevant PRs, fetch PR details per PR to get additions and deletions.

That is a real server-side fan-out problem. `skipBatch` does not solve it.

The GraphQL probe in `apps/web/src/lib/github/inbox.ts#L151-L299` and `packages/github/src/pull-requests.ts#L349-L429` already shows why GraphQL helps on this class of workload: it can collapse list and detail fields into one upstream query per repo.

## Current Query Map

## Inbox

### Initial inbox page load

The main inbox route prefetches `getInboxData` on the server in `apps/web/src/app/(protected)/page.tsx#L5-L21`.

That means the initial inbox render is not primarily blocked by client `httpBatchLink`. Its main risk is server-side GitHub fan-out in `loadInboxData()`.

### Inbox row queries and prefetches

Each inbox row currently does the following in `apps/web/src/app/(protected)/_components/inbox-view.tsx#L192-L245`:

1. `getCheckSummary` when the row becomes visible.
2. `getPullRequestPage` prefetch on hover/focus/open.
3. `getPullRequestStack` prefetch on hover/focus/open.
4. Diff summary prefetch via a plain `fetch` query, not tRPC.

Implications:

1. The hover prefetch pair `getPullRequestPage` + `getPullRequestStack` is a strong `skipBatch` candidate because page data is more important than stack data.
2. The per-row `getCheckSummary` pattern is not a good blanket `skipBatch` candidate because many visible rows would become many unbatched HTTP requests. This is better solved with aggregation.

## Pull request page

### Route-level prefetch

The route prefetches `getPullRequestPage` and `getPullRequestStack` on the server in `apps/web/src/app/(protected)/repo/[owner]/[repo]/pull/[number]/page.tsx#L16-L39`.

That reduces the initial load cost for those two queries, but it does not cover all the client suspense islands below.

### PR client query surface

The PR screen currently fans into separate client query islands:

1. `getPullRequestPage` in `apps/web/src/app/(protected)/repo/_components/pull-request-view.tsx#L157-L164`.
2. `getPullRequestDiscussion` in `apps/web/src/app/(protected)/repo/_components/discussion-section.tsx#L55-L65`.
3. `getPullRequestReviewComments` in `apps/web/src/app/(protected)/repo/_components/diff-section.tsx#L223-L228`.
4. `getCheckSummary` in `apps/web/src/app/(protected)/repo/_components/checks-panel.tsx#L75-L77`.
5. `getPullRequestStack` in `apps/web/src/app/(protected)/repo/_components/stack-panel.tsx#L21-L28`.
6. `getCheckRuns` only after opening the checks panel in `apps/web/src/app/(protected)/repo/_components/checks-panel.tsx#L78-L83`.
7. `listRepoLabels` only after opening the labels panel in `apps/web/src/app/(protected)/repo/_components/label-panel.tsx#L47-L49`.

The PR page is also explicitly split into separate suspense regions in `apps/web/src/app/(protected)/repo/_components/pull-request-view.tsx#L606-L641`, which is exactly where batched transport can undermine isolation: separate UI boundaries exist, but the underlying tRPC requests can still be delivered together.

## What `skipBatch` Should And Should Not Do

## Use `skipBatch` for

Use `skipBatch` where one expensive query should not delay a sibling, and where query count stays small.

Recommended first targets:

1. `getPullRequestPage` hover/open prefetch from inbox rows.
2. `getPullRequestStack` hover/open prefetch from inbox rows.
3. `getPullRequestDiscussion` on the PR page.
4. `getPullRequestReviewComments` on the PR page.
5. `getCheckSummary` on the PR page.
6. `getPullRequestStack` on the PR page.
7. `getPullRequestPage` in any client path where it refetches after invalidation or navigation warmup.

Why these are good candidates:

1. They are user-facing and latency-sensitive.
2. They have visibly different runtimes.
3. They are few in number, so unbatching them will not explode HTTP request count.

## Do not use `skipBatch` blindly for

Do not just mark every inbox row status query as `skipBatch`.

Bad candidate:

1. Per-row `getCheckSummary` in the inbox list.

Why it is a bad blanket target:

1. A full inbox viewport can start many row-level queries together.
2. Unbatching all of them can create too many HTTP requests.
3. The better fix is to aggregate them into a single list-oriented query.

## GraphQL vs REST

## Where GraphQL looks strongest

GraphQL is most promising for read-heavy surfaces that currently need a list plus extra detail calls.

### 1. Inbox data

This is the strongest candidate.

The current REST inbox loader in `apps/web/src/lib/github/inbox.ts#L303-L470` does list + reviews + detail fan-out. The GraphQL probe already showed a faster shape for the `merging` rule in `apps/web/src/lib/github/inbox.ts#L151-L299` backed by `packages/github/src/pull-requests.ts#L349-L429`.

Why GraphQL fits:

1. One upstream query can request the exact fields used by classification.
2. It reduces repo-level list/detail fan-out.
3. It is a read model, not a mutation flow.

Constraint:

1. The exact inbox rule logic must remain unchanged.
2. The implementation should still reuse `DEFAULT_INBOX_SECTION_RULES`, `deriveInboxClassificationFacts`, and `matchesInboxCondition`.

### 2. Pull request discussion

`getPullRequestDiscussionData()` currently does two REST calls in parallel in `apps/web/src/lib/github/pull-request.ts#L167-L188`.

Why GraphQL fits:

1. Comments and reviews are one read shape.
2. A single GraphQL query could fetch both.
3. This is a good candidate for a self-contained read-model migration.

### 3. Repository pull request list page

`getRepositoryPullRequestsPageData()` in `apps/web/src/lib/github/pull-request.ts#L406-L455` does a repo list call, then per-PR detail and per-PR review calls.

Why GraphQL fits:

1. This is a classic N+1 read surface.
2. The page needs a predictable field set and review state.
3. It is likely to benefit more than targeted single-PR detail routes.

### 4. Stack derivation

`getPullRequestStack()` in `apps/web/src/lib/github/stack.ts#L15-L69` lists all PRs and derives the chain client-side.

GraphQL may help, but it is a second-tier candidate.

Why it is weaker than inbox:

1. The algorithm still needs chain reconstruction logic.
2. The current cost is one repo-level list call, not an obvious multi-call fan-out.
3. It may benefit more from transport isolation than from an upstream API swap.

## Where REST should likely stay

REST remains a better default for targeted detail fetches, mutations, and APIs where GitHub REST is already the natural fit.

### Keep REST for

1. `getPullRequestPageData()` in `apps/web/src/lib/github/pull-request.ts#L144-L165` because it is one direct PR detail fetch.
2. Checks APIs in `apps/web/src/lib/github/checks.ts#L13-L47` because the current REST shape is already straightforward and mature.
3. Diff and raw patch paths, which already use dedicated endpoints and parsing.
4. File tree and file content routes.
5. Mutations for labels, reviewers, comments, review submission, merge, and ready-for-review.

Reasoning:

1. These flows are already simple or single-call.
2. GraphQL would not clearly reduce round trips enough to justify complexity.
3. Some GitHub surfaces are easier to reason about and test through REST.

## Recommended Plan

## Phase 1: Fix client head-of-line blocking on PR and inbox navigation

Apply `skipBatch` selectively to the small set of latency-sensitive GitHub queries named above.

Work items:

1. Add shared query option helpers for PR-critical queries so `skipBatch` usage is consistent.
2. Use those helpers in inbox hover prefetch for `getPullRequestPage` and `getPullRequestStack`.
3. Use those helpers in PR suspense islands for discussion, review comments, stack, and check summary.
4. Leave low-priority open-on-demand queries like labels and check runs batched for now.

Success criteria:

1. PR subpanels can resolve independently.
2. Hover/open prefetch for PR page data no longer waits on stack.
3. Network panel shows separate non-batched requests for marked queries.

## Phase 2: Fix inbox row status loading with aggregation, not mass unbatching

Replace row-by-row `getCheckSummary` behavior with a bulk visible-row request.

Work items:

1. Reuse or extend `getCheckSummaries` instead of issuing one row query per card.
2. Query for the currently visible inbox refs in one request.
3. Keep row rendering incremental, but source the data from a grouped result.

Success criteria:

1. Fewer client HTTP requests on a full inbox viewport.
2. No need to set `skipBatch` on dozens of row queries.
3. Better total load time and smoother scrolling.

## Phase 3: Migrate the highest-value server read models to GraphQL upstream

Start with inbox, then consider repo PR list, then PR discussion.

Recommended order:

1. Inbox read path.
2. Repository PR list page.
3. Pull request discussion read model.
4. Stack only if profiling still shows material cost.

Rules for the migration:

1. Keep GitHub GraphQL behind the shared package abstraction.
2. Keep tRPC as the app transport.
3. Reuse existing domain mappers and rule logic instead of reimplementing behavior in the page.
4. Preserve REST implementations until parity is proven.

## Phase 4: Measure before and after

Use existing logging plus route timing to confirm real gains.

Measurement checklist:

1. Compare network waterfall before and after `skipBatch` on PR route islands.
2. Compare time-to-first-pane-render for PR discussion, checks, stack, and diff comments.
3. Compare inbox server timing before and after any GraphQL migration.
4. Keep reading `github.inbox_probe` events for the merging comparison page as a baseline.

## Risks

1. Blanket `skipBatch` can increase HTTP request count and make list screens noisier.
2. GraphQL migrations can accidentally drift from existing REST-backed behavior if field mapping is not exact.
3. GitHub GraphQL pagination and missing fields can complicate some surfaces.
4. Migrating low-value single-call routes to GraphQL adds complexity without meaningful latency wins.

## Proposed Decision Summary

1. Use `skipBatch` surgically for inbox navigation and PR page islands.
2. Do not use `skipBatch` as the main fix for inbox row status summaries; aggregate those instead.
3. Treat GraphQL as the tool for server-side read-model fan-out, especially inbox and repo PR lists.
4. Keep REST for targeted detail, diff, checks, trees, and mutations.
