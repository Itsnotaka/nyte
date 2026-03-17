## Learned User Preferences

- Avoid unnecessary placeholder params and `undefined` values in function
  inputs; only pass fields when needed.
- Enforce strict non-null `userId` for backend processes and validate it at
  process boundaries.
- Do not use emojis unless explicitly requested.
- Prefer the tRPC TanStack Query integration (`@trpc/tanstack-react-query`) over
  the classic React Query integration (`@trpc/react-query`). Use
  `createTRPCContext` for context-based setups and `useTRPC()` /
  `trpc.*.queryOptions()` / `trpc.*.mutationOptions()` at call sites.
- Always use `sachi-*` Tailwind v4 semantic tokens (e.g., `bg-sachi-base`,
  `text-sachi-fg`, `border-sachi-line`) instead of `[var(--color-*)]` arbitrary
  value syntax in all component code. `@sachikit/ui` components must natively
  use these tokens so coloring is consistent when the package is published.
- Never use raw `[var(--color-*)]` class syntax in JSX; use the generated
  Tailwind utility name instead.
- Prefer flat component layouts over nested compound components (e.g., avoid
  wrapping each diff file in a LayerCard inside another LayerCard); use plain
  divs with subtle separators when nesting adds no value.
- Use `date-fns` for date calculations and formatting instead of native Date
  arithmetic.
- Do not use inline type imports (e.g. `import("pkg").Type`); always use
  top-level import statements for types.

## Learned Workspace Facts

- Sachikit design tokens are defined in `tooling/tailwind/theme.css` as
  `--color-sachi-*` inside `@theme inline` using CSS `light-dark(light, dark)`.
  Token groups: surfaces (`sachi-shell`, `sachi-sidebar`, `sachi-surface`,
  `sachi-base`, `sachi-fill`, `sachi-fill-hover`, `sachi-overlay`), borders
  (`sachi-line`, `sachi-line-subtle`), text (`sachi-fg`, `sachi-fg-secondary`,
  `sachi-fg-muted`, `sachi-fg-faint`), accent (`sachi-accent`, `sachi-rail`,
  `sachi-focus`). The theme is exported as `@sachikit/ui/styles`.
- Dark mode for `light-dark()` is driven by `color-scheme: light` / `dark`
  toggled via the `.dark` class; Tailwind's `dark:` variant is not used for
  sachikit tokens.
- `evlog` (`apps/web/src/lib/evlog.ts`) is the lightweight observability utility
  used to instrument GitHub API calls and other key runtime paths.
- User diff display preferences (diffStyle, contextLines, overflow,
  lineDiffType, hideComments) are persisted in the `user_diff_settings` DB table
  and exposed via the `settings` tRPC router with optimistic updates.
- Pull request markdown is rendered by `Streamdown` with explicit Tailwind
  arbitrary selectors for list styling (not `@tailwindcss/typography`).
- Client components must not import from the `@sachikit/db` barrel; use sub-path
  imports like `@sachikit/db/schema/settings` to avoid pulling in the db client
  that requires `DATABASE_URL`.

### Environment variables

All eight required env vars are defined in `apps/web/src/lib/server/env.ts`
(validated by `@t3-oss/env-nextjs`). They must be present in
`apps/web/.env.local`. In Cloud Agent environments the values come from injected
secrets; the update script writes them to `.env.local` on startup.

### Gotchas

- pnpm v10 ignores postinstall scripts by default. `pnpm rebuild` after install
  ensures native addons (`esbuild`, `sharp`, `@parcel/watcher`) are built.
- The `@sachikit/ui` package exports point `import` conditions to `dist/` files.
  Tests and the Next.js dev server will fail with "Cannot find package" errors
  if the UI package has never been built. Run `vp run build` in `packages/ui`
  once after a fresh install.
- `BETTER_AUTH_URL` must match the actual dev server origin (including port). If
  port 3000 is occupied and Next.js falls back to 3001, the OAuth callback will
  silently fail. Kill the conflicting process and ensure `next dev` binds to the
  port in `BETTER_AUTH_URL`.
- After killing the dev server, Next.js may leave a stale lock at
  `apps/web/.next/dev/lock`. Remove it (`rm apps/web/.next/dev/lock`) before
  restarting.
