## Style Guide

### Naming Conventions

| Category                    | Case                 | Example                              |
| --------------------------- | -------------------- | ------------------------------------ |
| Namespaces, Classes, Types  | PascalCase           | `ChatMessage`, `SplitViewStore`      |
| Components                  | PascalCase           | `ChatPanel`, `DesktopSidebar`        |
| Hooks, functions, variables | camelCase            | `useChatList`, `sendMessage`         |
| File names                  | kebab-case           | `use-chat-list.ts`, `chat-panel.tsx` |
| Constants                   | SCREAMING_SNAKE_CASE | `MAX_PANELS`, `DEFAULT_SIDE`         |

### General

- Keep things in one function unless composable or reusable
- Avoid unnecessary destructuring. Instead of `const { a, b } = obj`, use
  `obj.a` and `obj.b` to preserve context
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible

# Avoid let statements

We don't like `let` statements, especially combined with if/else statements.
Prefer `const`.

Good:

```ts
const foo = condition ? 1 : 2;
```

Bad:

```ts
let foo;

if (condition) foo = 1;
else foo = 2;
```

# Avoid else statements

Prefer early returns or using an `iife` to avoid else statements.

Good:

```ts
function foo() {
  if (condition) return 1;
  return 2;
}
```

Bad:

```ts
function foo() {
  if (condition) return 1;
  else return 2;
}
```

# Prefer single word naming

Try your best to find a single word name for your variables, functions, etc.
Only use multiple words if you cannot.

Good:

```ts
const foo = 1;
const bar = 2;
const baz = 3;
```

Bad:

```ts
const fooBar = 1;
const barBaz = 2;
const bazFoo = 3;
```
