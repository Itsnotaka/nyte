# Nyte

Nyte is a personal AI that lives in one thread. It reads your inbox and calendar
continuously and messages you when something needs your attention — a reply to
approve, an invite to accept, a refund to process. Like texting a friend who
also runs your email.

## Vision

Nyte is becoming a single-threaded AI that knows you frighteningly well — and
lives in one place, a text box, like Google. No triage UI, no syncing spinners,
no settings to configure. Your mom opens it and types.

### Interaction model

One infinite conversation thread, like iMessage. You send a message; it replies,
acts, or asks the one thing it needs from you. The AI handles the rest in the
background. You never look at a queue.

### What it does without being asked

- Checks you into your flight before you think of it
- Updates a calendar invite when your plans change
- Replies to emails on your behalf
- Reminds you of something a friend mentioned two weeks ago
- Flags the handful of things that actually need your answer — nothing else

### What it knows about you

- What you are working on, when it is due, and what you have done before
- How you slept last night (Whoop / Oura) and what you are listening to
  (Spotify)
- What you tweet and post
- Which newsletters you read and which topics you follow
- Who your family, friends, and coworkers are

### Personality

Direct, warm, a little dry — the way a sharp friend texts you, not the way a
customer support bot responds. No "Great question!", no filler.

### UX principle

If a feature requires the user to understand it, it does not ship. The only
visible surface is the thread. Ingestion, scoring, and action execution run
silently underneath. The infrastructure is the foundation; the interface above
it is a single conversation.

## How it works

1. Connect Google once. Nyte gains access to Gmail and Google Calendar.
2. Background ingestion pulls new signals incrementally — threads, invites,
   deadline changes.
3. Each signal is scored for urgency, relationship weight, and decision impact.
4. Signals above the threshold surface as messages in your thread.
5. You approve, edit, or skip. Approved actions execute immediately.
6. All state transitions are logged in Convex and carry an audit trail.

## What runs where

- `apps/web`: Next.js chat UI and Convex backend functions.
- `packages/domain`: urgency scoring, gate evaluation, and work item
  composition.
- `packages/integrations`: Gmail and Google Calendar ingestion adapters.
- `packages/pi-runtime` (`@nyte/extension-runtime`): action execution runtime
  for provider operations (save draft, create calendar event).
- `packages/ui`: shared UI primitives.

## Local setup

1. Install dependencies: `pnpm install`
2. Configure env in `apps/web/.env` or `apps/web/.env.local`
   - `BETTER_AUTH_SECRET=...`
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
3. Start Convex + Next.js: `pnpm dev`
4. Validate: `pnpm typecheck && pnpm lint`

## Extend the system

### Add an action handler

1. Add request/result contracts in `packages/pi-runtime/src/contracts.ts`.
2. Implement handler in `packages/pi-runtime/src/extensions/*`.
3. Register handler in `packages/pi-runtime/src/registry.ts`.
4. Dispatch from `apps/web/convex/actions.ts`.

### Add a workflow task

1. Add ingestion or orchestration logic in `apps/web/convex/ingestion.ts`.
2. Schedule background work in `apps/web/convex/crons.ts`.
3. Persist operational events in `apps/web/convex/runlog.ts`.
4. Wire any UI consumption via Convex queries/mutations.

### Add a signal gate

1. Update gate logic in `packages/domain/src/triage.ts`.
2. Persist/consume outputs in `apps/web/convex/ingestion.ts`.
3. Surface gate impact in the thread when relevant.
