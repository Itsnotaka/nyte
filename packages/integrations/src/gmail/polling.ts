import type { IntakeSignal } from "@nyte/domain/triage";

const GOOGLE_GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const DEFAULT_LOOKBACK_DAYS = 7;

export type GmailThreadSnapshot = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
};

export type PollingInput = {
  accessToken: string;
  cursor?: string;
  now?: Date;
  watchKeywords?: string[];
  maxResults?: number;
};

export type PollingResult = {
  nextCursor: string;
  signals: IntakeSignal[];
};

type GmailListResponse = {
  messages?: Array<{
    id: string;
  }>;
};

type GmailMessageMetadata = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{
      name?: string;
      value?: string;
    }>;
  };
};

function normalizeCursor(cursor: string | undefined, now: Date) {
  if (!cursor) {
    return new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  }

  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  }

  return parsed;
}

function toEpochSeconds(value: Date) {
  return Math.max(0, Math.floor(value.getTime() / 1000));
}

async function fetchGoogleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail API request failed with status ${response.status}: ${detail.slice(0, 240)}`);
  }

  return (await response.json()) as T;
}

function readHeader(metadata: GmailMessageMetadata, headerName: string) {
  const target = headerName.toLowerCase();

  for (const header of metadata.payload?.headers ?? []) {
    if (header.name?.toLowerCase() === target) {
      return header.value?.trim() ?? "";
    }
  }

  return "";
}

function extractActor(fromHeader: string) {
  const trimmed = fromHeader.trim();
  if (!trimmed) {
    return "Unknown sender";
  }

  const nameMatch = trimmed.match(/^(?:\"?([^\"<]+)\"?\s*)?<[^>]+>$/);
  if (nameMatch?.[1]) {
    return nameMatch[1].trim();
  }

  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+)@[a-zA-Z0-9.-]+/);
  if (emailMatch?.[1]) {
    return emailMatch[1]
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return trimmed;
}

function normalizeSnippet(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function inferIntent(subject: string, snippet: string) {
  const haystack = `${subject} ${snippet}`.toLowerCase();

  if (
    haystack.includes("refund") ||
    haystack.includes("chargeback") ||
    haystack.includes("cancel")
  ) {
    return "refund_request" as const;
  }

  return "draft_reply" as const;
}

function inferRelationshipScore(subject: string, actor: string) {
  const haystack = `${subject} ${actor}`.toLowerCase();
  if (
    haystack.includes("board") ||
    haystack.includes("exec") ||
    haystack.includes("legal") ||
    haystack.includes("renewal") ||
    haystack.includes("contract")
  ) {
    return 0.86;
  }

  return 0.52;
}

function inferImpactScore(subject: string, snippet: string, intent: "draft_reply" | "refund_request") {
  const haystack = `${subject} ${snippet}`.toLowerCase();

  if (intent === "refund_request") {
    return 0.84;
  }

  if (
    haystack.includes("urgent") ||
    haystack.includes("blocked") ||
    haystack.includes("deadline") ||
    haystack.includes("term sheet")
  ) {
    return 0.73;
  }

  return 0.46;
}

function inferDeadline(intent: "draft_reply" | "refund_request", now: Date) {
  if (intent === "refund_request") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  return undefined;
}

function toSignal(
  snapshot: GmailThreadSnapshot,
  watchKeywords: string[],
  now: Date,
): IntakeSignal {
  const intent = inferIntent(snapshot.subject, snapshot.snippet);
  const haystack = `${snapshot.subject} ${snapshot.snippet}`.toLowerCase();
  const watchMatched = watchKeywords.some((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );

  return {
    id: `gmail:${snapshot.id}`,
    source: "Gmail",
    actor: snapshot.from,
    summary: snapshot.subject || "Untitled email",
    context: snapshot.snippet || "No email snippet available.",
    preview: snapshot.snippet || snapshot.subject || "Open in Gmail for full content.",
    intent,
    requiresDecision: true,
    deadlineAt: inferDeadline(intent, now),
    relationshipScore: inferRelationshipScore(snapshot.subject, snapshot.from),
    impactScore: inferImpactScore(snapshot.subject, snapshot.snippet, intent),
    watchMatched,
  };
}

async function fetchMessageSnapshot(accessToken: string, messageId: string): Promise<GmailThreadSnapshot> {
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: "From",
  });
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "Date");

  const metadata = await fetchGoogleJson<GmailMessageMetadata>(
    `${GOOGLE_GMAIL_API}/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
    accessToken,
  );

  const fromHeader = readHeader(metadata, "From");
  const subjectHeader = readHeader(metadata, "Subject");
  const internalDate = metadata.internalDate ? Number.parseInt(metadata.internalDate, 10) : NaN;
  const receivedAt = Number.isFinite(internalDate)
    ? new Date(internalDate).toISOString()
    : new Date().toISOString();

  return {
    id: metadata.id,
    from: extractActor(fromHeader),
    subject: subjectHeader || "Untitled message",
    snippet: normalizeSnippet(metadata.snippet),
    receivedAt,
  };
}

export async function pollGmailIngestion({
  accessToken,
  cursor,
  now = new Date(),
  watchKeywords = [],
  maxResults = 20,
}: PollingInput): Promise<PollingResult> {
  const since = normalizeCursor(cursor, now);
  const query = `in:inbox -category:promotions after:${toEpochSeconds(since)}`;

  const listParams = new URLSearchParams({
    maxResults: String(Math.max(1, Math.min(maxResults, 50))),
    q: query,
  });

  const list = await fetchGoogleJson<GmailListResponse>(
    `${GOOGLE_GMAIL_API}/messages?${listParams.toString()}`,
    accessToken,
  );

  const messages = list.messages ?? [];
  if (messages.length === 0) {
    return {
      nextCursor: now.toISOString(),
      signals: [],
    };
  }

  const snapshots = await Promise.all(
    messages.map((message) => fetchMessageSnapshot(accessToken, message.id)),
  );

  snapshots.sort(
    (left, right) =>
      new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime(),
  );

  return {
    nextCursor: now.toISOString(),
    signals: snapshots.map((snapshot) => toSignal(snapshot, watchKeywords, now)),
  };
}
