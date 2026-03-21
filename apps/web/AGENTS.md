## Debugging

- NEVER try to restart the app, or the server process, EVER.

## Local Dev

- Open `http://localhost:3000` to verify UI changes.

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.

## Browser Automation

**Tool split:**
- **Playwright**: persistent actual browser for logged-in navigation, cache reuse, and `loading.tsx` behavior
- **`agent-browser`**: DOM automation, clicks, and form fills
- **`next-browser`**: Next.js-specific inspection — PPR, SSR shell, React tree, errors, and route metadata

### Playwright (actual browser)

Use the repo script when you need a real browser session that keeps auth across runs.

Setup once per machine (from repo root):

```bash
pnpm --filter web run playwright:chromium
```

Open the persistent browser:

```bash
pnpm --filter web run browser -- open http://localhost:3000
```

Notes:
- Profile lives at `apps/web/.playwright/profile`
- Login once, then reuse the same session for protected-route hydration checks
- Use this for real navigation, warm-cache revisits, and verifying that `loading.tsx` appears immediately
- For a short smoke run, add `--headless --timeout 5`

### DOM automation (`agent-browser`)

Use `agent-browser` for scripted browser automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

### Next.js inspection (`@vercel/next-browser`)

For a **running dev server**, use [`@vercel/next-browser`](https://www.npmjs.com/package/@vercel/next-browser) from the terminal when you need structured Next.js inspection: React DevTools data, Next overlay errors, route metadata, network, screenshots, and PPR shell analysis.

Setup once per machine (from repo root):

```bash
pnpm --filter web run playwright:chromium
```

Run the CLI via `pnpm --filter web run inspect -- <command>`, for example:

| Goal | Commands |
| --- | --- |
| Session | `… inspect -- open http://localhost:3000` then `… inspect -- close` when done |
| a11y / clicks | `snapshot` (refs like `e0`), `click e0`, `fill e1 "text"` |
| React tree | `tree`, `tree <id>` (props, hooks, state, source locations) |
| SSR shell | `ssr lock`, then `goto <url>`, then `screenshot`, then `ssr unlock` |
| Errors / logs | `errors`, `logs` |
| Network | `network`, `network <idx>` |
| Screenshot | `screenshot` (prints temp PNG path) |
| Route intel | `page`, `routes`, `project` |
| Perf | `perf [url]` |

### PPR and Suspense

- `ppr lock` freezes dynamic content so you can inspect the **static shell** (`goto` / `screenshot`), then `ppr unlock` prints a **shell analysis** (Suspense boundaries, dynamic holes, blockers).
- `ssr lock` blocks external scripts so you can inspect the SSR shell without client-side hydration interference.
- Use the PPR report to **shrink dynamic holes**: fewer or higher `Suspense` boundaries, less client-only work inside prerendered segments, and removing unnecessary `use client` / hook usage that forces a hole. The aim is more content in the cached static prerender without changing product behavior.

Do **not** use `next-browser restart-server` in this repo (same rule as above: never restart the dev server from tooling).
## tRPC

`~/lib/trpc/server` exports three things for RSC pages:

- **`caller`** -- direct tRPC procedure calls for server-only data (routing
  decisions, data the client never refetches). Does not touch the query cache.
- **`prefetch()`** -- fire-and-forget prefetch into TanStack Query cache so
  client components hydrate with data.
- **`HydrateClient`** -- passes dehydrated cache to the client.
- Use `caller.*` for server-only data; do not use `queryClient.fetchQuery()`.
- Use `prefetch()` for client hydration; do not use
  `queryClient.prefetchQuery()` directly.
- Let server queries return data or fail; do not use `.catch()` to swallow
  errors.
- Prefetch every query that child client components use via
  `useQuery(trpc.*.queryOptions())`. Missing prefetches cause client-side
  fetches and slower paint.
