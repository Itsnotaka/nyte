## Learned User Preferences

- Avoid unnecessary placeholder params and `undefined` values in function
  inputs; only pass fields when needed.
- Enforce strict non-null `userId` for backend processes and validate it at
  process boundaries.
- Do not use emojis unless explicitly requested.
- Prefer the tRPC TanStack Query integration (`@trpc/tanstack-react-query`) over
  the classic React Query integration (`@trpc/react-query`). Use
  `createTRPCContext` for context-based setups and `useTRPC()` with
  `trpc.*.queryOptions()` and `trpc.*.mutationOptions()` at call sites. Do not
  introduce GraphQL for app data fetching.
- Keep GitHub-shaped domain logic, inbox classification, review-signal rules,
  and Octokit helpers in `packages/github`; keep
  `apps/web/src/lib/github/server.ts` limited to app-specific orchestration.
- Prefer fast first paint with skeletons and hydrated TanStack Query plus tRPC
  caches on inbox and PR pages; with separate server client for RSC. Avoid
  overfetching and load heavier diff data lazily after the first file or page.
- Always use `sachi-*` Tailwind v4 semantic tokens such as `bg-sachi-base`,
  `text-sachi-fg`, and `border-sachi-line` instead of arbitrary
  `[var(--color-*)]` syntax. `@sachikit/ui` components should natively use these
  tokens.
- Never use raw `[var(--color-*)]` class syntax in JSX; use the generated
  Tailwind utility name instead.
- Prefer flat component layouts over nested compound components; use plain
  `div`s with subtle separators when nesting adds no value.
- Use `date-fns` for date calculations and formatting instead of native `Date`
  arithmetic.
- Do not use inline type imports such as `import("pkg").Type`; always use
  top-level import statements for types.

## Learned Workspace Facts

- Sachikit design tokens are defined in `tooling/tailwind/theme.css` as
  `--color-sachi-*` inside `@theme inline` using CSS `light-dark(light, dark)`.
  Token groups cover surfaces, borders, text, and accent colors, and the theme
  is exported as `@sachikit/ui/styles`.
- Dark mode for `light-dark()` is driven by `color-scheme: light` or `dark`
  toggled via the `.dark` class; Tailwind's `dark:` variant is not used for
  Sachikit tokens.
- `evlog` in `apps/web/src/lib/evlog.ts` is the lightweight observability
  utility used to instrument GitHub API calls and other key runtime paths.
- User diff display preferences (`diffStyle`, `contextLines`, `overflow`,
  `lineDiffType`, `hideComments`) are persisted in the `user_diff_settings`
  table and exposed through the `settings` tRPC router with optimistic updates.
- Pull request markdown is rendered by `Streamdown` with explicit Tailwind
  selectors for list styling rather than `@tailwindcss/typography`.
- Client components must not import from the `@sachikit/db` barrel; use sub-path
  imports such as `@sachikit/db/schema/settings` to avoid pulling in the db
  client that requires `DATABASE_URL`.
- All required env vars are defined in `apps/web/src/lib/server/env.ts`,
  validated by `@t3-oss/env-nextjs`, and must be present in
  `apps/web/.env.local`. In cloud agent environments, injected secrets are
  written there on startup.
- pnpm v10 ignores postinstall scripts by default, so `pnpm rebuild` after
  install is needed to build native addons such as `esbuild`, `sharp`, and
  `@parcel/watcher`.
- The `@sachikit/ui` package exports point `import` conditions to `dist/` files.
  Tests and the Next.js dev server can fail with "Cannot find package" errors if
  the UI package has never been built, so run `vp run build` in `packages/ui`
  once after a fresh install.
- `BETTER_AUTH_URL` must match the actual dev server origin, including the port.
  If port 3000 is occupied and Next.js falls back to 3001, the OAuth callback
  can fail silently.
- After killing the dev server, Next.js may leave a stale lock at
  `apps/web/.next/dev/lock`; remove it before restarting.
- Protected PR and commit loaders resolve repositories through
  `findRepoContext()`, which restricts access to repos that are both synced by
  the user and accessible to the GitHub App.
