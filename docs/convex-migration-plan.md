# Convex Migration: Product Research and Implementation Plan

## Executive Summary

Product research on migrating Nyte's database package (Drizzle + PlanetScale
Postgres) and TanStack Query/tRPC layer to Convex. Includes findings from 10
finder subagents, tradeoff analysis, convexskills patterns, and a step-by-step
Better Auth + Convex integration (pnpm).

### Runtime Contract Update (Current)

- Primary user surface is the `Important` list and inline command conversation.
- Command lifecycle is `preview` -> `respond` (follow-up) -> `confirm`.
- Command confirmations execute inline (no command-run todo queue indirection).
- Email confirmation executes send semantics (`gmail.send`) with idempotency,
  not draft-only behavior.
- pi-runtime requires Convex runtime env for LLM calls:
  - `OPENCODE_API_KEY`
  - `PI_RUNTIME_MODEL`

---

## 1. Current Architecture

### 1.1 Database Package

| Aspect         | Current Setup                                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ORM**        | Drizzle ORM                                                                                                                                                                                                                                         |
| **Driver**     | `@neondatabase/serverless` (Neon serverless pool)                                                                                                                                                                                                   |
| **Provider**   | PlanetScale Postgres                                                                                                                                                                                                                                |
| **Schema**     | 17 tables: users, accounts, sessions, verifications, connected_accounts, work_items, gate_evaluations, proposed_actions, gmail_drafts, calendar_events, policy_rules, audit_logs, workflow_runs, workflow_events, feedback_entries, ingestion_state |
| **Migrations** | Drizzle Kit; SQL files in `packages/db/drizzle/`                                                                                                                                                                                                    |

### 1.2 Data Fetching

- **API**: tRPC v11 with `httpBatchLink` to `/api/trpc`
- **Client**: TanStack Query + `@trpc/tanstack-react-query`
- **Procedures**: `queue.feed`, `queue.sync`, `agent.run`, `actions.approve`,
  `actions.dismiss`, `actions.feedback`
- **Auth**: Better Auth (Google OAuth, Gmail/Calendar scopes)

### 1.3 Server-First Benefit

With Convex, client-side sync orchestration is eliminated:

- **Today**: Client checks `isStale` -> triggers `queue.sync` -> invalidates
  feed -> refetches
- **Convex**: Client subscribes to feed query; server pushes updates; sync runs
  via cron only; no invalidation

---

## 2. Tradeoffs Summary

| Advantage                                        | Disadvantage                          |
| ------------------------------------------------ | ------------------------------------- |
| Real-time by default                             | No SQL; document-relational model     |
| Server-first; no client sync                     | Vendor lock-in; US regions only       |
| TanStack Query adapter (reactive)                | Adapter is beta                       |
| Better Auth + Convex keeps Gmail/Calendar scopes | Full tRPC/router rewrite              |
| No connection pooling                            | Schema evolution via backfill pattern |

---

## 3. Better Auth + Convex Integration (pnpm)

Step-by-step setup from
[Better Auth Convex docs](https://www.better-auth.com/docs/integrations/convex).
All commands use **pnpm**.

### 3.1 Prerequisites

```bash
# Create Convex project (choose "none" for auth)
pnpm create convex

# Run convex dev (keep running)
pnpm dlx convex dev
```

### 3.2 Install Packages

```bash
pnpm add better-auth@1.4.9 --save-exact
pnpm add @convex-dev/better-auth
```

### 3.3 Environment Variables

```bash
# Convex env (via CLI)
pnpm dlx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
pnpm dlx convex env set SITE_URL http://localhost:3000
```

Auth-related env (e.g. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`BETTER_AUTH_SECRET`) go in Convex, not `.env.local`.

**`.env.local`** (for Next.js):

```sh
CONVEX_DEPLOYMENT=dev:adjective-animal-123
NEXT_PUBLIC_CONVEX_URL=https://adjective-animal-123.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://adjective-animal-123.convex.site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3.4 Convex Auth Config

**`convex/auth.config.ts`**:

```ts
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
```

### 3.5 Better Auth Component

**`convex/betterAuth/convex.config.ts`**:

```ts
import { defineComponent } from "convex/server";

const component = defineComponent("betterAuth");

export default component;
```

**`convex/convex.config.ts`**:

```ts
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();

app.use(betterAuth);

export default app;
```

**`convex/betterAuth/auth.ts`** (Nyte: add Google with Gmail/Calendar scopes):

```ts
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
    verbose: false,
  }
);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: "Nyte",
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/calendar.events",
        ],
      },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
```

**Generate schema**:

```bash
pnpm dlx @better-auth/cli generate --config ./convex/betterAuth/auth.ts --output ./convex/betterAuth/schema.ts
```

**`convex/betterAuth/adapter.ts`**:

```ts
import { createApi } from "@convex-dev/better-auth";
import { createAuthOptions } from "./auth";
import schema from "./schema";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions);
```

### 3.6 Client Setup

**`lib/auth-client.ts`**:

```ts
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});
```

**`lib/auth-server.ts`**:

```ts
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
```

### 3.7 Mount Handlers

**`convex/http.ts`**:

```ts
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;
```

**`app/api/auth/[...all]/route.ts`**:

```ts
import { handler } from "@/lib/auth-server";

export const { GET, POST } = handler;
```

### 3.8 Convex Client Provider

**`components/ConvexClientProvider.tsx`**:

```tsx
"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: React.ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
```

**`app/layout.tsx`**:

```tsx
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { getToken } from "@/lib/auth-server";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const token = await getToken();
  return (
    <html>
      <body>
        <ConvexClientProvider initialToken={token}>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

### 3.9 Access Token for Gmail/Calendar

Nyte uses `auth.api.getAccessToken()` for Gmail/Calendar. With Convex + Better
Auth:

- `auth.api.*` runs inside Convex functions via
  `authComponent.getAuth(createAuth, ctx)`
- Use `fetchAuthMutation` or `fetchAuthAction` from server-side for auth calls
- For access tokens: Better Auth stores tokens in `accounts`; Convex component
  adapter exposes them; ensure `auth.api.getAccessToken()` equivalent is
  available via the auth component's internal API

### 3.10 Convex Env for Auth

Set in Convex dashboard or via CLI:

```bash
pnpm dlx convex env set GOOGLE_CLIENT_ID "..."
pnpm dlx convex env set GOOGLE_CLIENT_SECRET "..."
```

---

## 4. Migration Phases

### Phase 1: Auth on Convex

1. Add Convex project and Better Auth component (above)
2. Migrate auth tables: `users`, `accounts`, `sessions` from Postgres to Convex
3. Run both Postgres and Convex for auth during cutover; dual-write until
   validated
4. Remove Better Auth Drizzle adapter; switch to Convex component

### Phase 2: Feed and Queue (Read Path)

1. Convex schema for `work_items`, `gate_evaluations`, `proposed_actions`,
   `ingestion_state`
2. Convex query for feed (replaces `queue.feed`)
3. Convex cron for ingestion (replaces Vercel cron + `queue.sync`)
4. Client: replace tRPC `queue.feed` with
   `useQuery(convexQuery(api.queue.feed, {}))`

### Phase 3: Mutations

1. Convex mutations for `actions.approve`, `actions.dismiss`,
   `actions.feedback`, `agent.run`
2. Client: replace tRPC mutations with Convex mutations
3. Remove tRPC router

### Phase 4: Full Deprecation

1. Migrate remaining tables: `audit_logs`, `workflow_runs`, `workflow_events`,
   `feedback_entries`, etc.
2. Remove `@nyte/db`, Drizzle, Postgres connection
3. Remove Vercel cron

---

## 5. References

- [Better Auth Convex Integration](https://www.better-auth.com/docs/integrations/convex)
- [Convex Documentation](https://docs.convex.dev)
- [Convex + TanStack Query](https://docs.convex.dev/client/tanstack/tanstack-query/)
- [Migrate Postgres to Convex](https://stack.convex.dev/migrate-data-postgres-to-convex)
- [convexskills](https://github.com/waynesutton/convexskills)
- [docs/auth-research-convex-vs-better-auth.md](auth-research-convex-vs-better-auth.md)
