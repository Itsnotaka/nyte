import type { WorkItem } from "./triage";

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

export function withToolCalls(workItems: WorkItem[]): WorkItemWithAction[] {
  return workItems.map((workItem) => ({
    ...workItem,
    proposedAction: createToolCallPayload(workItem),
  }));
}
