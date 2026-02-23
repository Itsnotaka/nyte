# Convex Authentication vs Better Auth: Research and Migration Path

## Executive Summary

The Nyte app currently uses **Better Auth** with Postgres/Drizzle, Google OAuth (including Gmail/Calendar scopes), and Next.js. This document compares Convex Auth with Better Auth and outlines migration paths.

---

## 1. Convex Authentication

### Built-in Auth (Convex Auth Library)

- **Status**: Beta; may change in backward-incompatible ways
- **Package**: `@convex-dev/auth` + `@auth/core`
- **Backend**: Runs entirely on Convex (no separate auth server)
- **Use case**: React, React Native, or Next.js apps using Convex as the backend

**Supported methods**:
- OAuth (GitHub, Google, Apple; Auth.js providers)
- Passwords (with optional email verification)
- Magic links and OTPs

**OAuth flow**:
1. User authenticates with provider (e.g. Google)
2. Callback URL is the Convex HTTP Actions URL: `https://<deployment>.convex.site/api/auth/callback/google`
3. Credentials stored via Convex env vars: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

### Session Management

- **Storage**: `users` and `authSessions` tables in Convex
- **Token**: JWT used by `ConvexReactClient` and `ctx.auth.getUserIdentity()`
- **Behavior**: JWT is the source of truth; deleting a session does not sign the user out until the JWT expires
- **Multiple sessions**: Supported per user
- **Custom domain**: `CUSTOM_AUTH_SITE_URL` for production OAuth consent screen

### Accessing Auth State

- **Backend**: `getAuthUserId()`, `getAuthSessionId()`, `ctx.auth.getUserIdentity()`
- **Frontend**: `Authenticated`, `Unauthenticated`, `AuthLoading` wrappers; `useAuthActions()` for `signIn`/`signOut`

### Limitations

- Next.js support is experimental
- No built-in Gmail/Calendar scope configuration (standard OAuth scopes only)
- Beta status implies possible breaking changes

---

## 2. Better Auth

### Overview

- **Status**: Production-ready, open-source
- **Package**: `better-auth`
- **Backend**: Runs in your app (Next.js route handlers) or as a standalone server
- **Database**: Adapters for Drizzle, Prisma, Kysely, etc.

**Features**:
- Email/password, social sign-in (Google, GitHub, etc.)
- 2FA, passkeys, multi-session, multi-tenancy
- Plugin system (e.g. `oAuthProxy`, `nextCookies`)
- Rate limiting, hooks, OpenAPI
- Framework-agnostic

### Current Nyte Setup

- **Adapter**: Drizzle + Postgres
- **Provider**: Google with Gmail + Calendar scopes
- **Session**: Cookie-based (`storeStateStrategy: "cookie"`)
- **API**: `auth.api.getSession()`, `auth.api.getAccessToken()` for server-side
- **Client**: `authClient.signIn.social()`, `authClient.signOut()`, `authClient.useSession()`

---

## 3. Comparison

| Aspect | Convex Auth | Better Auth |
|--------|-------------|-------------|
| **Maturity** | Beta | Production |
| **Backend** | Convex only | Any (Next.js, standalone, etc.) |
| **Database** | Convex tables | Your DB (Postgres, etc.) |
| **OAuth providers** | GitHub, Google, Apple (+ Auth.js) | Many, including Google |
| **Custom OAuth scopes** | Via provider `profile()` | First-class (e.g. Gmail scopes) |
| **Session** | JWT + Convex tables | Cookie + DB sessions |
| **Access tokens** | Via Auth.js provider config | `auth.api.getAccessToken()` |
| **Next.js** | Experimental | First-class |
| **Convex integration** | Native | Via `@convex-dev/better-auth` |

### Gmail/Calendar Scopes

Nyte uses extended Google scopes for Gmail and Calendar. Convex Auth uses standard Auth.js providers; custom scopes require provider configuration (e.g. `scope` in the Google provider). Better Auth supports this directly in `socialProviders.google.scope`.

---

## 4. Convex + Better Auth Integration

Convex provides an official integration: **Better Auth on Convex** (`@convex-dev/better-auth`).

- Better Auth runs as a Convex component
- Auth tables live in Convex instead of Postgres
- `auth.api` methods run inside Convex functions
- Sign-in/sign-out must be done from the client (no HTTP cookies for Convex RPCs)
- Route handlers are mounted on Convex HTTP router and proxied from Next.js

**Use when**: You want Convex as the backend but keep Better Auth’s features and API.

---

## 5. Migration Paths

### Path A: Stay on Better Auth (Current)

- **Effort**: None
- **When**: No Convex adoption planned
- **Notes**: Current setup is production-ready and supports Gmail/Calendar scopes

---

### Path B: Migrate to Convex Auth

**When**: You adopt Convex as the primary backend and are fine with beta auth.

**Steps**:

1. **Adopt Convex**
   - Add Convex project and `convex dev`
   - Add `authTables` to Convex schema

2. **Configure Convex Auth**
   - Install `@convex-dev/auth` and `@auth/core`
   - Create `convex/auth.ts` with Google provider
   - Configure Google OAuth callback: `https://<deployment>.convex.site/api/auth/callback/google`
   - Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` in Convex env

3. **Custom Gmail/Calendar scopes**
   - Extend Google provider config with `scope`:
     ```ts
     Google({
       authorization: {
         params: {
           scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly ...",
         },
       },
     })
     ```

4. **Replace Better Auth usage**
   - Session: `auth.api.getSession()` → `ctx.auth.getUserIdentity()` in Convex functions
   - Access token: use Auth.js provider tokens or custom storage; Convex Auth does not expose `getAccessToken` directly—you may need to store tokens in Convex tables via `createOrUpdateUser`/`afterUserCreatedOrUpdated` callbacks
   - Client: `authClient.signIn.social()` → `signIn("google")` from `useAuthActions()`
   - tRPC context: obtain `userId` from Convex identity instead of Better Auth session

5. **Data migration**
   - Map Better Auth `users`/`accounts`/`sessions` to Convex `users`/`authAccounts`/`authSessions`
   - Migrate `connectedAccounts` and any app-specific user data

6. **Remove**
   - Better Auth packages and config
   - Drizzle auth tables (after migration)
   - `/api/auth/[...all]` route (auth handled by Convex HTTP actions)

**Risks**: Beta status; access token handling for Gmail/Calendar may need custom logic.

---

### Path C: Migrate to Convex + Better Auth

**When**: You adopt Convex but want to keep Better Auth’s API and features.

**Steps**:

1. **Adopt Convex**
   - Add Convex project
   - Install `@convex-dev/better-auth` and `better-auth` (pinned version per docs)

2. **Set up Better Auth component**
   - Create `convex/auth.config.ts` with `getAuthConfigProvider()`
   - Create `convex/betterAuth/` component (schema, auth config, adapter)
   - Register component in Convex app
   - Mount auth routes on Convex HTTP router

3. **Configure env**
   - `BETTER_AUTH_SECRET`, `SITE_URL` in Convex
   - `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` in Next.js

4. **Update Next.js**
   - Replace `toNextJsHandler(auth)` with Convex proxy handler
   - Add `ConvexBetterAuthProvider` with `convexClient()` plugin
   - Use `getToken()`, `preloadAuthQuery`, etc. for SSR

5. **Update server usage**
   - `auth.api.*` calls move into Convex functions using `authComponent.getAuth(createAuth, ctx)`
   - tRPC or other server code must obtain session/token from Convex or pass through Convex

6. **Data migration**
   - Migrate Postgres auth tables to Convex (Better Auth schema)
   - Migrate app tables that reference `userId` if moving to Convex DB

**Notes**: Keeps Better Auth API and Gmail/Calendar scopes; adds Convex as backend. Server-side sign-in/sign-out is not supported—must use client `authClient.signIn.*`.

---

## 6. Recommendation

| Scenario | Recommendation |
|----------|----------------|
| No Convex adoption | **Path A** – Stay on Better Auth |
| Convex adoption, need Gmail/Calendar tokens | **Path C** – Convex + Better Auth |
| Convex adoption, minimal auth needs | **Path B** – Convex Auth (with custom token handling) |

For Nyte’s current Gmail/Calendar integration and `auth.api.getAccessToken()` usage, **Path C (Convex + Better Auth)** is the most straightforward way to adopt Convex while preserving existing auth behavior.

---

## References

- [Convex Auth](https://docs.convex.dev/auth)
- [Convex Auth OAuth](https://labs.convex.dev/auth/config/oauth)
- [Convex Auth Google](https://labs.convex.dev/auth/config/oauth/google)
- [Convex Auth Advanced](https://labs.convex.dev/auth/advanced)
- [Better Auth Introduction](https://www.better-auth.com/docs/introduction)
- [Better Auth Convex Integration](https://www.better-auth.com/docs/integrations/convex)
- [Convex + Better Auth Basic Usage](https://labs.convex.dev/better-auth/basic-usage)
