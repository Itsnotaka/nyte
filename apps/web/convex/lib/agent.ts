import type { Doc } from "../_generated/dataModel";

type QueueItem = Doc<"queueItems">;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const AMOUNT_PATTERN = /\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/;
const CALENDAR_DURATION_MS = 60 * 60 * 1000;

function normalizeMessage(message: string): string {
  const compact = message.trim().replace(/\s+/g, " ");
  return compact.slice(0, 5000);
}

function extractEmails(message: string, limit: number): string[] {
  const matches = message.match(EMAIL_PATTERN) ?? [];
  const emails = new Set<string>();

  for (const match of matches) {
    if (emails.size >= limit) {
      break;
    }
    emails.add(match.toLowerCase());
  }

  return [...emails];
}

function parseAmount(message: string): number {
  const matched = message.match(AMOUNT_PATTERN)?.at(1);
  if (!matched) {
    return 0;
  }
  const parsed = Number.parseFloat(matched);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function parseCommandKind(
  message: string
): QueueItem["proposedAction"]["kind"] {
  const lower = message.toLowerCase();
  if (/\b(schedule|meeting|event|invite|calendar)\b/.test(lower)) {
    return "google-calendar.createEvent";
  }
  if (/\b(refund|credit|reimburse|chargeback)\b/.test(lower)) {
    return "billing.queueRefund";
  }
  return "gmail.createDraft";
}

function buildDraftPayload(message: string): QueueItem["proposedAction"] {
  const normalized = normalizeMessage(message);
  const recipients = extractEmails(normalized, 20);
  return {
    kind: "gmail.createDraft",
    to: recipients.length > 0 ? recipients : ["team@nyte.ai"],
    subject: normalized.slice(0, 300) || "Quick follow-up",
    body: normalized || "Please draft a concise response.",
  };
}

function buildCalendarPayload(
  message: string,
  now: number
): QueueItem["proposedAction"] {
  const normalized = normalizeMessage(message);
  const startsAt = new Date(now + CALENDAR_DURATION_MS);
  const endsAt = new Date(startsAt.getTime() + CALENDAR_DURATION_MS);
  return {
    kind: "google-calendar.createEvent",
    title: normalized.slice(0, 300) || "Follow-up meeting",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    attendees: extractEmails(normalized, 50),
    description: normalized || "Schedule from command input.",
  };
}

function buildRefundPayload(message: string): QueueItem["proposedAction"] {
  const normalized = normalizeMessage(message);
  const customerName = extractEmails(normalized, 1).at(0) ?? "customer@nyte.ai";
  return {
    kind: "billing.queueRefund",
    customerName: customerName.slice(0, 300),
    amount: parseAmount(normalized),
    currency: "USD",
    reason: normalized || "Customer requested a refund.",
  };
}

function actionPresentation(
  kind: QueueItem["proposedAction"]["kind"]
): Pick<
  QueueItem,
  "type" | "source" | "actionLabel" | "secondaryLabel" | "cta"
> {
  if (kind === "google-calendar.createEvent") {
    return {
      type: "calendar",
      source: "Google Calendar",
      actionLabel: "Open scheduling form",
      secondaryLabel: "Decline",
      cta: "Create event",
    };
  }

  if (kind === "billing.queueRefund") {
    return {
      type: "refund",
      source: "Gmail",
      actionLabel: "Prepare refund response",
      secondaryLabel: "Dismiss",
      cta: "Queue refund",
    };
  }

  return {
    type: "draft",
    source: "Gmail",
    actionLabel: "Review draft reply",
    secondaryLabel: "Dismiss",
    cta: "Save draft",
  };
}

function previewForPayload(payload: QueueItem["proposedAction"]): string {
  if (payload.kind === "google-calendar.createEvent") {
    return `${payload.title} • ${payload.startsAt}`;
  }
  if (payload.kind === "billing.queueRefund") {
    return `${payload.customerName} • $${payload.amount.toFixed(2)} ${payload.currency}`;
  }
  return payload.body.slice(0, 500);
}

export function buildQueueItemFromCommand(args: {
  userId: string;
  message: string;
  now: number;
  itemId: string;
}): Omit<QueueItem, "_id" | "_creationTime"> {
  const kind = parseCommandKind(args.message);
  const payload =
    kind === "google-calendar.createEvent"
      ? buildCalendarPayload(args.message, args.now)
      : kind === "billing.queueRefund"
        ? buildRefundPayload(args.message)
        : buildDraftPayload(args.message);
  const presentation = actionPresentation(payload.kind);
  const summary = normalizeMessage(args.message).slice(0, 300);

  return {
    workItemId: args.itemId,
    userId: args.userId,
    type: presentation.type,
    source: presentation.source,
    actor: "You",
    summary: summary.length > 0 ? summary : "Queued command",
    context: "Queued from command input.",
    preview: previewForPayload(payload),
    actionLabel: presentation.actionLabel,
    secondaryLabel: presentation.secondaryLabel,
    cta: presentation.cta,
    gates: ["decision"],
    priorityScore: 100,
    status: "awaiting_approval",
    proposedAction: payload,
    createdAt: args.now,
    updatedAt: args.now,
  };
}
