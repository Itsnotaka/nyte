# Motion

You're an expert in Motion, GSAP and web animation in general.

## Importing

- Never import from `framer-motion`. Only import from `motion`.

## `animate`

- `animate` has three valid syntaxes.
  - `animate(motionValue, targetValue, options)`
  - `animate(originValue, targetValue, options)` - Add `onUpdate` to `options`
  - `animate(objectOrElement, values, options)`
- When animating motion values, don't track the current animation in variable,
  use `value.stop()` to end the current animation. The current animation will
  also be ended by starting a new animation.
- Easing is defined via the `ease` option and is camel case, for instance
  `easeOut` not `ease-out`.

## Motion Values

- Never use `value.onChange(update)`, always use `value.on("change", update)`

## Performance

- Inside functions that will, or could, run every animation frame:
  - Avoid object allocation, prefer mutation where safe.
  - Prefer `for` loops over `forEach` or `map` etc.
  - Avoid `Object.entries`, `Object.values` etc as these create new objects.
- Outside of these functions, revert to your normal coding style as defined
  either by your natural behaviour or other rules.
- If animating a `transform` like `transform`, `x`, `y`, `scale` etc, then add
  style the component with `willChange: "transform"`. If animating
  `backgroundColor`, `clipPath`, `filter`, `opacity`, also add these values to
  `willChange`. Preferably, this style will be added along with the other styles
  for this component, for instance in an included stylesheet etc.
- **Only** ever add these values to `willChange`:
  - `transform`
  - `opacity`
  - `clipPath`
  - `filter`
- Coerce numbers and strings between each other in as few steps as possible.
- Prefer animating `transform` over independent transforms like `x`, `scaleX`
  etc for hardware accelerated animations. Use independent transforms when you
  might have competing/composable transforms:

```javascript
animate(element, { x: 100 });

hover(() => {
  animate(element, { scale: 1.2 });

  return () => animate(element, { scale: 1 });
});
```

- Always use independent transforms when defining any transform via `style` i.e.
  `<motion.div animate={{ x: 100 }} style={{ scale: 2 }} />` and always use
  independent transforms when mixing with layout animations.

## Principles

- Prefer `will-change`/`willChange` over `transform: translateZ(0)`. This can be
  added along with all the other styles if you're generating any.

## `useReducedMotion` (from `motion/react`)

- Import from `motion/react` only (never `framer-motion` directly; see Importing).
- Re-exported from Motion’s Framer Motion layer: it wires `prefers-reduced-motion`
  via Motion’s internal listener (`initPrefersReducedMotion`) and
  `useState(prefersReducedMotion.current)` so the **initial** render is stable for
  SSR/hydration (no `useEffect` delay).
- Prefer this over ad‑hoc `matchMedia("(prefers-reduced-motion)")` in `useEffect`,
  which runs **after** paint and can cause a one-frame style jump.

## Viewport layout vs RSC / client boundaries

- A **Client Component** is still **server-rendered** in Next.js; the boundary does
  not give you the real viewport width on the server.
- Hooks like `useMediaQuery` / `useMobile` cannot know `(max-width: …)` until the
  client runs, so **branching the React tree on `isMobile`** (e.g. drawer vs
  desktop sidebar) will often **shift after hydration** unless you also express
  that layout in **CSS** (`@media`) or accept a loading/placeholder strategy.
- For **inset padding** and similar, prefer **CSS** driven by `data-*` on ancestors
  plus `@media (min-width: …)` so **first paint** matches the viewport without
  waiting for JS (see `SidebarInset` in `@sachikit/ui`).
