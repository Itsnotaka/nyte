## Learned User Preferences

- Avoid unnecessary placeholder params and `undefined` values in function
  inputs; only pass fields when needed.
- Prefer simpler local usage over extracting constants into separate files when
  reuse is low.
- Prefer `useState` for UI state flow instead of `useRef` for mutable control
  flags unless ref semantics are required.
- Enforce strict non-null `userId` for backend processes and validate it at
  process boundaries.
- Do not use emojis unless explicitly requested.
- Prefer the tRPC TanStack Query integration (`@trpc/tanstack-react-query`) over
  the classic React Query integration (`@trpc/react-query`). Use
  `createTRPCContext` for context-based setups and `useTRPC()` /
  `trpc.*.queryOptions()` / `trpc.*.mutationOptions()` at call sites.
- Prefer runtime-first architecture in monorepo work: push intelligence,
  filtering, and workflow logic into `packages/` (especially
  `packages/pi-runtime`) and keep app frontend code thin.
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
- Use `@central-icons-react` for icon components instead of other icon
  libraries.
- Never use GraphQL; prefer tRPC + Octokit REST for all GitHub data fetching.

## Learned Workspace Facts

- Queue flow is split: `queue.feed` is the read path and `queue.sync` is the
  refresh trigger path.
- Important feed refresh policy is stale-gated on app open with a 2-minute
  threshold.
- Background queue refresh is scheduled via cron every 5 minutes.
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
- The diff viewer is `@pierre/diffs` (v1.1.0). It renders inside a shadow DOM;
  custom styling (e.g., font size) is injected via the `unsafeCSS` option on
  `BaseCodeOptions`.
- User diff display preferences (diffStyle, contextLines, overflow,
  lineDiffType, hideComments) are persisted in the `user_diff_settings` DB table
  and exposed via the `settings` tRPC router with optimistic updates.
- LayerCard token assignments: `bg-sachi-fill` (root), `bg-sachi-base`
  (primary), `ring-sachi-line` (borders), modeled after Cloudflare Kumo's
  layered card pattern.
- Pull request markdown is rendered by `Streamdown` with explicit Tailwind
  arbitrary selectors for list styling (not `@tailwindcss/typography`).
- Client components must not import from the `@sachikit/db` barrel; use sub-path
  imports like `@sachikit/db/schema/settings` to avoid pulling in the db client
  that requires `DATABASE_URL`.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown,
Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management,
package management, and frontend tooling in a single global CLI called `vp`.
Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and
`vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run
`vp help` to print a list of commands and `vp <command> --help` for information
about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as
pnpm, npm, or Yarn through the `packageManager` field in `package.json` or
package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example,
`vp dev --port 3000` runs Vite's dev server and works the same as Vite.
`vp test` runs JavaScript tests through the bundled Vitest. The version of all
tools can be checked using `vp --version`. This is useful when researching
documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn
  directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or
  `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ commands take precedence over `package.json`
  scripts. If there is a `test` script defined in `scripts` that conflicts with
  the built-in `vp test` command, run it using `vp run test`.
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps
  these tools. They must not be installed directly. You cannot upgrade these
  tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of
  package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from
  `vite` or `vitest`, all modules should be imported from the project's
  `vite-plus` dependency. For example,
  `import { defineConfig } from 'vite-plus';` or
  `import { expect, test, vi } from 'vite-plus/test';`. You must not install
  `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`,
  `vp lint --type-aware` works out of the box.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

## Cursor Cloud specific instructions

### Architecture

Sachi is a pnpm monorepo with a single Next.js 16 full-stack app (`apps/web`)
and internal packages (`packages/db`, `packages/github`, `packages/ui`,
`tooling/tailwind`, `tooling/typescript`). There are no Docker services, message
queues, or local databases -- the app connects to **Neon Postgres** (remote) and
**GitHub API** (remote) via environment variables.

### Running services

- **Dev server:** `pnpm turbo run dev --filter=web` (runs `next dev` on port
  3000). Do **not** use `vp dev` for the web app -- that starts a bare Vite
  server, not Next.js.
- **UI package watch:** `cd packages/ui && vp run build` (or `vp pack --watch`
  for continuous rebuilds). The UI dist must be built at least once before tests
  or the dev server can resolve `@sachikit/ui/components/*` imports.

### Lint / Test / Typecheck

- `vp lint` -- Oxlint across the monorepo (fast, ~25 ms)
- `vp test` -- Vitest (requires `@sachikit/ui` dist to exist)
- `pnpm turbo run typecheck` -- tsgo across all workspaces
- `vp check` -- runs format + lint + typecheck in one pass; may report
  pre-existing formatting issues

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
