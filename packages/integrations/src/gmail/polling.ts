import type { IntakeIntent, IntakeSignal } from "@workspace/domain/triage";

export type GmailThreadSnapshot = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  relationshipScore?: number;
  impactScore?: number;
};

export type PollingInput = {
  cursor?: string;
  now?: Date;
  watchKeywords?: string[];
};

export type PollingResult = {
  nextCursor: string;
  signals: IntakeSignal[];
};

const mockGmailSnapshots: GmailThreadSnapshot[] = [
  {
    id: "gmail_renewal",
    from: "David Kim",
    subject: "Signed term sheet attached",
    snippet: "I've sent over the signed copy for final countersignature.",
    receivedAt: "2026-01-20T10:00:00.000Z",
    relationshipScore: 0.92,
    impactScore: 0.88,
  },
  {
    id: "gmail_board",
    from: "Rachel Torres",
    subject: "Board sync planning and agenda update",
    snippet: "Can we lock in the calendar slot and finalize board prep?",
    receivedAt: "2026-01-20T11:00:00.000Z",
    relationshipScore: 0.81,
    impactScore: 0.72,
  },
  {
    id: "gmail_refund",
    from: "Joe",
    subject: "Refund request for unavailable integration",
    snippet: "Please refund this month since Notion integration isn't ready.",
    receivedAt: "2026-01-20T11:30:00.000Z",
    relationshipScore: 0.34,
    impactScore: 0.78,
  },
];

function inferIntent(subject: string, snippet: string): IntakeIntent {
  const value = `${subject} ${snippet}`.toLowerCase();
  if (value.includes("refund")) {
    return "refund_request";
  }

  if (value.includes("calendar") || value.includes("meeting") || value.includes("board")) {
    return "schedule_event";
  }

  return "draft_reply";
}

function buildSignal(snapshot: GmailThreadSnapshot, watchKeywords: string[] = []): IntakeSignal {
  const intent = inferIntent(snapshot.subject, snapshot.snippet);
  const hasDeadline = intent !== "draft_reply";
  const haystack = `${snapshot.subject} ${snapshot.snippet}`.toLowerCase();
  const watchMatched = watchKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));

  return {
    id: snapshot.id,
    source: intent === "schedule_event" ? "Google Calendar" : "Gmail",
    actor: snapshot.from,
    summary: snapshot.subject,
    context: snapshot.snippet,
    preview: snapshot.snippet,
    intent,
    requiresDecision: true,
    deadlineAt: hasDeadline ? "2026-01-22T14:00:00.000Z" : undefined,
    relationshipScore: snapshot.relationshipScore,
    impactScore: snapshot.impactScore,
    watchMatched,
  };
}

export function pollGmailIngestion({
  cursor,
  now = new Date(),
  watchKeywords = [],
}: PollingInput): PollingResult {
  const parsedCursorTime = cursor ? new Date(cursor).getTime() : Number.NEGATIVE_INFINITY;
  const cursorTime = Number.isFinite(parsedCursorTime)
    ? parsedCursorTime
    : Number.NEGATIVE_INFINITY;
  const freshSnapshots = mockGmailSnapshots.filter(
    (snapshot) => new Date(snapshot.receivedAt).getTime() > cursorTime,
  );

  return {
    nextCursor: now.toISOString(),
    signals: freshSnapshots.map((snapshot) => buildSignal(snapshot, watchKeywords)),
  };
}
