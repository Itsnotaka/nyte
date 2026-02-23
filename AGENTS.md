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

## Learned Workspace Facts

- Queue flow is split: `queue.feed` is the read path and `queue.sync` is the
  refresh trigger path.
- Important feed refresh policy is stale-gated on app open with a 2-minute
  threshold.
- Background queue refresh is scheduled via cron every 5 minutes.
