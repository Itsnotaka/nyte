import { Effect } from "effect";

import type { ToolCallPayload } from "./actions";

export type ActionDestination =
  | "gmail_drafts"
  | "google_calendar"
  | "refund_queue";

export type ExecutionResult = {
  status: "executed";
  destination: ActionDestination;
  providerReference: string;
  idempotencyKey: string;
  executedAt: string;
};

const prefixes: Record<ToolCallPayload["kind"], ActionDestination> = {
  "gmail.createDraft": "gmail_drafts",
  "google-calendar.createEvent": "google_calendar",
  "billing.queueRefund": "refund_queue",
};

function deterministicHash(seed: string): string {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function payloadSeed(payload: ToolCallPayload): string {
  if (payload.kind === "gmail.createDraft") {
    return [
      payload.kind,
      payload.to.join(","),
      payload.subject,
      payload.body,
    ].join("|");
  }

  if (payload.kind === "google-calendar.createEvent") {
    return [
      payload.kind,
      payload.title,
      payload.startsAt,
      payload.endsAt,
      payload.attendees.join(","),
      payload.description,
    ].join("|");
  }

  return [
    payload.kind,
    payload.customerName,
    payload.amount,
    payload.currency,
    payload.reason,
  ].join("|");
}

function defaultIdempotencyKey(payload: ToolCallPayload): string {
  return `exec_${deterministicHash(payloadSeed(payload))}`;
}

type ExecutionOptions = {
  idempotencyKey?: string;
};

export function executeProposedAction(
  payload: ToolCallPayload,
  now = new Date(),
  options: ExecutionOptions = {}
): ExecutionResult {
  const destination = prefixes[payload.kind];
  const seed = payloadSeed(payload);
  const providerReference = `${destination}_${deterministicHash(seed)}`;
  const idempotencyKey =
    options.idempotencyKey ?? defaultIdempotencyKey(payload);

  return {
    status: "executed",
    destination,
    providerReference,
    idempotencyKey,
    executedAt: now.toISOString(),
  };
}

export const executeProposedActionProgram = (
  payload: ToolCallPayload,
  now = new Date(),
  options: ExecutionOptions = {}
) => Effect.sync(() => executeProposedAction(payload, now, options));
