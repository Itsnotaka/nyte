import type { ToolCallPayload } from "@nyte/domain/actions";

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
  const matchedAmount = message.match(AMOUNT_PATTERN)?.at(1);
  if (!matchedAmount) {
    return 0;
  }

  const parsedAmount = Number.parseFloat(matchedAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return 0;
  }

  return parsedAmount;
}

function buildDraftPayload(message: string): ToolCallPayload {
  const normalizedMessage = normalizeMessage(message);
  const recipients = extractEmails(normalizedMessage, 20);

  return {
    kind: "gmail.createDraft",
    to: recipients.length > 0 ? recipients : ["team@nyte.ai"],
    subject: normalizedMessage.slice(0, 300) || "Quick follow-up",
    body: normalizedMessage || "Please draft a concise response.",
  };
}

function buildCalendarPayload(message: string, now: Date): ToolCallPayload {
  const normalizedMessage = normalizeMessage(message);
  const startsAt = new Date(now.getTime() + CALENDAR_DURATION_MS);
  const endsAt = new Date(startsAt.getTime() + CALENDAR_DURATION_MS);

  return {
    kind: "google-calendar.createEvent",
    title: normalizedMessage.slice(0, 300) || "Follow-up meeting",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    attendees: extractEmails(normalizedMessage, 50),
    description: normalizedMessage || "Schedule from command input.",
  };
}

function buildRefundPayload(message: string): ToolCallPayload {
  const normalizedMessage = normalizeMessage(message);
  const recipient =
    extractEmails(normalizedMessage, 1).at(0) ?? "customer@nyte.ai";

  return {
    kind: "billing.queueRefund",
    customerName: recipient.slice(0, 300),
    amount: parseAmount(normalizedMessage),
    currency: "USD",
    reason: normalizedMessage || "Customer requested a refund.",
  };
}

export function parseCommandToToolCall(
  message: string
): ToolCallPayload["kind"] {
  const lower = message.toLowerCase();

  if (/\b(schedule|meeting|event|invite|calendar)\b/.test(lower)) {
    return "google-calendar.createEvent";
  }

  if (/\b(refund|credit|reimburse|chargeback)\b/.test(lower)) {
    return "billing.queueRefund";
  }

  return "gmail.createDraft";
}

export function buildDefaultPayload(
  kind: ToolCallPayload["kind"],
  message: string,
  now = new Date()
): ToolCallPayload {
  if (kind === "google-calendar.createEvent") {
    return buildCalendarPayload(message, now);
  }

  if (kind === "billing.queueRefund") {
    return buildRefundPayload(message);
  }

  return buildDraftPayload(message);
}
