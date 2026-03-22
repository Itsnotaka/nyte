# Inbox: remove full-page empty state

## Goal

Always show the same inbox UI (probes + collapsible sections with counts), including when every section has zero PRs. **No conditional** and **no** `InboxEmptyState` — not even for “no repos synced” or “all fetches failed”; those situations continue to be surfaced via [`InboxDiagnosticsBanner`](<apps/web/src/app/(protected)/_components/inbox-view.tsx>) and section bodies where applicable.

## Changes (single file)

[`apps/web/src/app/(protected)/_components/inbox-view.tsx`](<apps/web/src/app/(protected)/_components/inbox-view.tsx>)

1. **Delete** the `InboxEmptyState` function (all three variants).
2. **Remove** the ternary in `InboxView` that chose between `InboxEmptyState` and the section list. Always render the inner `div` with `probes` + `orderedSections` (same structure as today’s non-empty branch).
3. **Drop** unused imports: `Empty`, `EmptyDescription`, `EmptyHeader`, `EmptyTitle` from `@sachikit/ui/components/empty` (only referenced by `InboxEmptyState`).
4. **Remove** now-dead locals in `InboxView` if any exist only for the empty branch (e.g. if `totalItems` / `hasProbes` were only used for that condition — verify and delete unused variables).

## Verification

- `pnpm typecheck` from repo root.

## Out of scope

Repo-scoped [`pull-request-list-view.tsx`](<apps/web/src/app/(protected)/repo/[owner]/[repo]/pulls/_components/pull-request-list-view.tsx>) empty state unchanged unless requested separately.
