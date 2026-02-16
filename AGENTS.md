# Nyte Agent Guideline

## Commands

- **Typecheck**: `pnpm typecheck`
- **Lint**: `pnpm lint` (add `--fix` for auto-fix via oxlint)
- **Format**: `pnpm fmt`

> Do NOT run `pnpm dev` or `pnpm build` - interactive/long-running

---

Project Overview

- Monorepo
- Desktop UI app lives in apps/desktop (primary UI surface)
- apps/web is marketing + LLM API routes; ignore for UI work unless asked
- Tailwind Parser in packages/tailwind
- UI package in packages/ui (customized shadcn)
- Cloudfalre durable object content in packages/function (partkit and durable
  object)

## Core Principles

Verify your claims, do not make assumptions after failed actions (like a file
read or fetched resource/URL). Inform the user. Don't add comments, unless
explicitly asked for. Performance is key, both high level (design) and low level
(impl). Write code that is **accessible, performant, type-safe, and
maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance
  clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants
  with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property
  access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return
  value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array
  indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client
  Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

## Imports

- Motion: `motion` not `framer-motion`
- Icons: `@central-icons-react/round-filled-radius-2-stroke-1.5`
- UI: `@nyte/ui/components/*`

## Tailwind v4

- See `/rules/tailwind.md`

## Commits

```git
<type>(<scope>): <short one sentence description>
```

Examples: `fix: resolve type conflict`, `feat(cli): add file sync`

## Planning

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if
  any.
