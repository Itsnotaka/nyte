- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `main`.
- Prefer automation: execute requested actions without confirmation unless
  blocked by missing info or safety/irreversibility.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Rely on type inference when possible; avoid explicit type annotations or
  interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use
  type guards on filter to maintain type inference downstream

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- no single-use boolean wrapper helpers.
- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or
  ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative
  is clear.
- Before finishing edits, review touched lines and shorten newly introduced
  identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`,
  `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`,
  `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1;
function journal(dir: string) {}

// Bad
const fooBar = 1;
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json();

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = await Bun.file(journalPath).json();
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a;
obj.b;

// Bad
const { a, b } = obj;
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of
reassignment.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1;
  return 2;
}

// Bad
function foo() {
  if (condition) return 1;
  else return 2;
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as
strings.

```ts
// Good - packages/db `user_diff_settings`
const user_diff_settings = pgTable("user_diff_settings", {
  user_id: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  settings: jsonb().notNull(),
  updated_at: timestamp().notNull(),
});

// Bad — redundant column strings and camelCase keys
const userDiffSettings = pgTable("user_diff_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, {
      onDelete: "cascade",
    }),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests

## Type Checking

- Always run `pnpm typecheck` from root, never `tsc` directly.

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "using `~/lib/trpc/server` `caller.*` for server-only data in RSC pages"
  load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/server/skills/server-side-calls/SKILL.md"
- task: "prefetching client queries with `prefetch()` + `HydrateClient` or wiring `useTRPC()` queryOptions/mutationOptions"
  load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/tanstack-react-query/skills/react-query-setup/SKILL.md"
- task: "structuring `appRouter`, `createTRPCContext`, routers, and base procedures"
  load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/server/skills/server-setup/SKILL.md"
- task: "writing timing, auth, or context-narrowing tRPC middleware like `protectedProcedure`"
  load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/server/skills/middlewares/SKILL.md"
- task: "working on Better Auth session handling in tRPC context or protected procedures"
  load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/server/skills/auth/SKILL.md"
- task: "keeping `superjson` aligned between `initTRPC.create` and `httpBatchLink`"
  load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/client/skills/superjson/SKILL.md"
- task: "mapping Octokit + Effect v4 beta failures into `TRPCError` codes and messages"
load: "/Users/workgyver/Developer/sachi/apps/web/node_modules/@trpc/server/skills/error-handling/SKILL.md"
<!-- intent-skills:end -->
