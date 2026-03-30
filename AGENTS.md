- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

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

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

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

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = pgTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
});

// Bad
const table = pgTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  - task: "setting up or changing tRPC routers, procedures, or context"
    load: "node_modules/@trpc/server/skills/server-setup/SKILL.md"
  - task: "working on the tRPC API route or Next.js request handler"
    load: "node_modules/@trpc/server/skills/adapter-fetch/SKILL.md"
  - task: "protecting procedures or changing auth/session behavior inside tRPC"
    load: "node_modules/@trpc/server/skills/auth/SKILL.md"
  - task: "working on tRPC React Query integration in providers and hooks"
    load: "node_modules/@trpc/tanstack-react-query/skills/react-query-setup/SKILL.md"
  - task: "changing the tRPC client link chain, batching, or headers"
    load: "node_modules/@trpc/client/skills/links/SKILL.md"
  - task: "configuring SuperJSON transformer on client or server"
    load: "node_modules/@trpc/client/skills/superjson/SKILL.md"
  - task: "creating reusable tRPC middlewares"
    load: "node_modules/@trpc/server/skills/middlewares/SKILL.md"
  - task: "handling tRPC errors and TRPCError patterns"
    load: "node_modules/@trpc/server/skills/error-handling/SKILL.md"
  - task: "adding input or output validators to procedures"
    load: "node_modules/@trpc/server/skills/validators/SKILL.md"
  - task: "calling tRPC procedures from server-side code"
    load: "node_modules/@trpc/server/skills/server-side-calls/SKILL.md"
  - task: "working on the shared UI package build or component packaging workflow"
    load: "node_modules/vite-plus/skills/vite-plus/SKILL.md"
<!-- intent-skills:end -->
