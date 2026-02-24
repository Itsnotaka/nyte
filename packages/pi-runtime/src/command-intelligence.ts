import type {
  RuntimePromptPart,
  RuntimeRetrievalHit,
  RuntimeRiskLevel,
} from "@nyte/domain";
import type { ToolCallPayload } from "@nyte/domain/actions";

import { openCodeJsonCompletion } from "./opencode";

const EMAIL_MATCH_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const MENTION_HANDLE_PATTERN = /(^|[\s([{'"`])@([a-z0-9._-]+)/gi;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isLikelyEmail(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(normalized);
}

export function extractEmails(message: string, limit: number): string[] {
  const matches = message.match(EMAIL_MATCH_PATTERN) ?? [];
  const emails = new Set<string>();

  for (const match of matches) {
    if (emails.size >= limit) {
      break;
    }
    emails.add(normalizeEmail(match));
  }

  return [...emails];
}

export function extractMentionHandles(
  message: string,
  limit: number
): string[] {
  MENTION_HANDLE_PATTERN.lastIndex = 0;
  const handles = new Set<string>();
  let matched: RegExpExecArray | null = MENTION_HANDLE_PATTERN.exec(message);

  while (matched) {
    const handle = matched[2]?.trim().toLowerCase();
    const nextCharacter = message[MENTION_HANDLE_PATTERN.lastIndex];
    const isEmailStyleToken = nextCharacter === "@";
    if (handle && !isEmailStyleToken) {
      handles.add(handle);
    }
    if (handles.size >= limit) {
      break;
    }
    matched = MENTION_HANDLE_PATTERN.exec(message);
  }

  return [...handles];
}

export function firstSuggestedContactEmail(args: {
  message: string;
  parts: RuntimePromptPart[];
}): string | undefined {
  const knownContactEmails = new Set(
    args.parts
      .filter(
        (part): part is Extract<RuntimePromptPart, { type: "contact" }> =>
          part.type === "contact"
      )
      .map((part) => normalizeEmail(part.email))
  );
  const extracted = extractEmails(args.message, 20);

  for (const email of extracted) {
    if (!knownContactEmails.has(email)) {
      return email;
    }
  }

  return undefined;
}

export type RuntimeCommandTurnStatus =
  | "awaiting_follow_up"
  | "awaiting_approval";

export type RuntimeConversationTurn = {
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export type RuntimeCommandProposal = {
  type: "draft" | "calendar" | "refund";
  source: "Gmail" | "Google Calendar";
  summary: string;
  context: string;
  actionLabel: string;
  secondaryLabel: string;
  cta: "Send email" | "Create event" | "Queue refund";
  preview: string;
  riskLevel: RuntimeRiskLevel;
  suggestionText: string;
  suggestedContactEmail?: string;
  payload: ToolCallPayload;
};

export type RuntimeCommandTurnRequest = {
  message: string;
  parts: RuntimePromptPart[];
  retrievalHits: RuntimeRetrievalHit[];
  conversation: RuntimeConversationTurn[];
  previousProposal?: RuntimeCommandProposal;
};

export type RuntimeCommandTurnResult = {
  status: RuntimeCommandTurnStatus;
  followUpQuestion?: string;
  proposal: RuntimeCommandProposal;
  retrievalHits: RuntimeRetrievalHit[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return normalized;
}

function isRiskLevel(value: unknown): value is RuntimeRiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

function parseToolPayload(value: unknown): ToolCallPayload | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (record.kind === "gmail.createDraft") {
    const to = asStringArray(record.to);
    const subject = asNonEmptyString(record.subject);
    const body = asNonEmptyString(record.body);
    if (!to || to.length === 0 || !subject || !body) {
      return null;
    }
    return {
      kind: "gmail.createDraft",
      to,
      subject,
      body,
    };
  }

  if (record.kind === "google-calendar.createEvent") {
    const title = asNonEmptyString(record.title);
    const startsAt = asNonEmptyString(record.startsAt);
    const endsAt = asNonEmptyString(record.endsAt);
    const attendees = asStringArray(record.attendees);
    const description = asNonEmptyString(record.description);
    if (!title || !startsAt || !endsAt || !attendees || !description) {
      return null;
    }
    return {
      kind: "google-calendar.createEvent",
      title,
      startsAt,
      endsAt,
      attendees,
      description,
    };
  }

  if (record.kind === "billing.queueRefund") {
    const customerName = asNonEmptyString(record.customerName);
    const reason = asNonEmptyString(record.reason);
    const currency = record.currency;
    const amount = typeof record.amount === "number" ? record.amount : NaN;
    if (
      !customerName ||
      !reason ||
      currency !== "USD" ||
      !Number.isFinite(amount)
    ) {
      return null;
    }
    return {
      kind: "billing.queueRefund",
      customerName,
      amount,
      currency: "USD",
      reason,
    };
  }

  return null;
}

function proposalPresentation(
  payload: ToolCallPayload
): Pick<
  RuntimeCommandProposal,
  "type" | "source" | "actionLabel" | "secondaryLabel" | "cta"
> {
  if (payload.kind === "google-calendar.createEvent") {
    return {
      type: "calendar",
      source: "Google Calendar",
      actionLabel: "Review event details",
      secondaryLabel: "Dismiss",
      cta: "Create event",
    };
  }

  if (payload.kind === "billing.queueRefund") {
    return {
      type: "refund",
      source: "Gmail",
      actionLabel: "Review refund details",
      secondaryLabel: "Dismiss",
      cta: "Queue refund",
    };
  }

  return {
    type: "draft",
    source: "Gmail",
    actionLabel: "Review email before sending",
    secondaryLabel: "Dismiss",
    cta: "Send email",
  };
}

function fallbackPreviewFromPayload(payload: ToolCallPayload): string {
  if (payload.kind === "google-calendar.createEvent") {
    return `${payload.title} • ${payload.startsAt}`;
  }
  if (payload.kind === "billing.queueRefund") {
    return `${payload.customerName} • $${payload.amount.toFixed(2)} ${payload.currency}`;
  }
  return `${payload.to.join(", ")} • ${payload.subject}`;
}

function parseRuntimeTurnOutput(
  output: unknown,
  request: RuntimeCommandTurnRequest
): {
  followUpQuestion?: string;
  proposal: RuntimeCommandProposal;
} {
  const parsed = asRecord(output);
  if (!parsed) {
    throw new Error("Command intelligence returned non-object output.");
  }

  const payload = parseToolPayload(parsed.payload);
  if (!payload) {
    throw new Error("Command intelligence payload is invalid.");
  }

  const summary =
    asNonEmptyString(parsed.summary) ?? request.message.trim().slice(0, 300);
  const preview =
    asNonEmptyString(parsed.preview) ?? fallbackPreviewFromPayload(payload);
  const riskLevelRaw = parsed.riskLevel;
  if (!isRiskLevel(riskLevelRaw)) {
    throw new Error("Command intelligence riskLevel is invalid.");
  }
  const suggestionText =
    asNonEmptyString(parsed.suggestionText) ??
    "Adjust this prompt if you want a different action.";
  const followUpQuestion =
    asNonEmptyString(parsed.followUpQuestion) ?? undefined;

  const presentation = proposalPresentation(payload);

  return {
    followUpQuestion,
    proposal: {
      ...presentation,
      summary,
      context: "Generated from inline command conversation.",
      preview,
      riskLevel: riskLevelRaw,
      suggestionText,
      suggestedContactEmail: firstSuggestedContactEmail({
        message: request.message,
        parts: request.parts,
      }),
      payload,
    },
  };
}

export async function interpretCommandTurn(
  request: RuntimeCommandTurnRequest
): Promise<RuntimeCommandTurnResult> {
  const completion = await openCodeJsonCompletion({
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content:
          "You are Nyte command runtime. Decide the next action for the user. Always return JSON with keys: payload, summary, preview, riskLevel, suggestionText, followUpQuestion. payload.kind must be one of gmail.createDraft, google-calendar.createEvent, billing.queueRefund. If key details are missing, include a concise followUpQuestion. Do not return markdown.",
      },
      {
        role: "user",
        content: JSON.stringify({
          message: request.message,
          parts: request.parts,
          retrievalHits: request.retrievalHits.slice(0, 8),
          conversation: request.conversation.slice(-12),
          previousProposal: request.previousProposal
            ? {
                payload: request.previousProposal.payload,
                summary: request.previousProposal.summary,
                preview: request.previousProposal.preview,
              }
            : null,
        }),
      },
    ],
  });

  const parsed = parseRuntimeTurnOutput(completion.json, request);
  const status: RuntimeCommandTurnStatus = parsed.followUpQuestion
    ? "awaiting_follow_up"
    : "awaiting_approval";

  return {
    status,
    followUpQuestion: parsed.followUpQuestion,
    proposal: parsed.proposal,
    retrievalHits: request.retrievalHits,
  };
}
