import type { WorkItem } from "./triage";
import { Effect } from "effect";

export type GmailCreateDraftToolCall = {
  kind: "gmail.createDraft";
  to: string[];
  subject: string;
  body: string;
};

export type GoogleCalendarCreateEventToolCall = {
  kind: "google-calendar.createEvent";
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: string[];
  description: string;
};

export type BillingQueueRefundToolCall = {
  kind: "billing.queueRefund";
  customerName: string;
  amount: number;
  currency: "USD";
  reason: string;
};

export type ToolCallPayload =
  | GmailCreateDraftToolCall
  | GoogleCalendarCreateEventToolCall
  | BillingQueueRefundToolCall;

export type WorkItemWithAction = WorkItem & {
  proposedAction: ToolCallPayload;
};

export function createProposedActionId(workItemId: string): string {
  return `${workItemId}:action`;
}

export const createProposedActionIdProgram = (workItemId: string) =>
  Effect.sync(() => createProposedActionId(workItemId));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

export function isToolCallPayload(value: unknown): value is ToolCallPayload {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  if (value.kind === "gmail.createDraft") {
    return (
      isStringArray(value.to) &&
      typeof value.subject === "string" &&
      typeof value.body === "string"
    );
  }

  if (value.kind === "google-calendar.createEvent") {
    return (
      typeof value.title === "string" &&
      typeof value.startsAt === "string" &&
      typeof value.endsAt === "string" &&
      isStringArray(value.attendees) &&
      typeof value.description === "string"
    );
  }

  if (value.kind === "billing.queueRefund") {
    return (
      typeof value.customerName === "string" &&
      typeof value.amount === "number" &&
      value.currency === "USD" &&
      typeof value.reason === "string"
    );
  }

  return false;
}

function actorToEmail(actor: string) {
  const slug = actor.toLowerCase().replaceAll(" ", ".");
  return `${slug}@example.com`;
}

function parseRefundAmount(preview: string): number {
  const amount = preview.match(/\$([0-9]+(?:\.[0-9]{1,2})?)/)?.at(1);
  if (!amount) {
    return 0;
  }

  return Number.parseFloat(amount);
}

export function createToolCallPayload(workItem: WorkItem): ToolCallPayload {
  if (workItem.type === "calendar") {
    return {
      kind: "google-calendar.createEvent",
      title: `${workItem.actor} • Board Sync`,
      startsAt: "2026-01-22T14:00:00.000Z",
      endsAt: "2026-01-22T15:00:00.000Z",
      attendees: [actorToEmail(workItem.actor), "team@nyte.ai"],
      description: workItem.preview,
    };
  }

  if (workItem.type === "refund") {
    return {
      kind: "billing.queueRefund",
      customerName: workItem.actor,
      amount: parseRefundAmount(workItem.preview),
      currency: "USD",
      reason: workItem.summary,
    };
  }

  return {
    kind: "gmail.createDraft",
    to: [actorToEmail(workItem.actor)],
    subject: `Re: ${workItem.summary}`,
    body: workItem.preview,
  };
}

export const createToolCallPayloadProgram = (workItem: WorkItem) =>
  Effect.sync(() => createToolCallPayload(workItem));

export function withToolCalls(workItems: WorkItem[]): WorkItemWithAction[] {
  return workItems.map((workItem) => ({
    ...workItem,
    proposedAction: createToolCallPayload(workItem),
  }));
}

export const withToolCallsProgram = (workItems: WorkItem[]) =>
  Effect.sync(() => withToolCalls(workItems));
