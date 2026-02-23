import type { IntakeSignal } from "@nyte/domain/triage";
import { Data, Effect } from "effect";

import { runIntegrationsEffect } from "../effect-runtime";

const GOOGLE_GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const DEFAULT_LOOKBACK_DAYS = 7;
const GMAIL_HISTORY_CURSOR_PREFIX = "history:";
const GMAIL_TIME_CURSOR_PREFIX = "time:";

type GmailCursorState = {
  historyId: string | null;
  since: Date;
};

type GmailMessage = {
  id: string;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailListPayload = {
  messages: GmailMessage[];
};

type GmailHistoryPayload = {
  messageIds: string[];
  historyId: string | null;
};

type GmailProfilePayload = {
  historyId: string | null;
};

type GmailMetadataPayload = {
  id: string;
  snippet: string;
  internalDate: number | null;
  headers: GmailHeader[];
};

export type GmailThreadSnapshot = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
};

export type GmailIngestionInput = {
  accessToken: string;
  cursor?: string;
  now?: Date;
  watchKeywords?: string[];
  maxResults?: number;
};

export type GmailIngestionResult = {
  nextCursor: string;
  signals: IntakeSignal[];
};

type GoogleApiError = Data.TaggedEnum<{
  GmailGoogleApiError: {
    status: number;
    detail: string;
    message: string;
  };
}>;

const GmailIngestionErrors = Data.taggedEnum<GoogleApiError>();

function googleApiError(status: number, detail: string): GoogleApiError {
  return GmailIngestionErrors.GmailGoogleApiError({
    status,
    detail,
    message: `Gmail API request failed with status ${status}: ${detail}`,
  });
}

function isGoogleApiError(error: unknown): error is GoogleApiError {
  return GmailIngestionErrors.$is("GmailGoogleApiError")(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value;
}

function asNonEmptyString(value: unknown): string | null {
  const text = asString(value);
  if (!text) {
    return null;
  }

  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function parseList(value: unknown): GmailListPayload {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error("Invalid Gmail messages response payload.");
  }

  const rawMessages = payload.messages;
  if (rawMessages === undefined) {
    return { messages: [] };
  }

  if (!Array.isArray(rawMessages)) {
    throw new Error(
      "Invalid Gmail messages response payload: messages must be an array."
    );
  }

  return {
    messages: rawMessages.map((entry) => {
      const message = asRecord(entry);
      const id = message ? asNonEmptyString(message.id) : null;
      if (!id) {
        throw new Error(
          "Invalid Gmail messages response payload: message id is required."
        );
      }

      return { id };
    }),
  };
}

function parseInternalDate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const text = asNonEmptyString(value);
  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseHeaders(payload: Record<string, unknown> | null): GmailHeader[] {
  if (!payload) {
    return [];
  }

  const rawHeaders = payload.headers;
  if (rawHeaders === undefined) {
    return [];
  }

  if (!Array.isArray(rawHeaders)) {
    throw new Error(
      "Invalid Gmail metadata payload: headers must be an array."
    );
  }

  return rawHeaders.flatMap((entry) => {
    const header = asRecord(entry);
    if (!header) {
      return [];
    }

    const name = asNonEmptyString(header.name);
    const value = asString(header.value);
    if (!name || value === null) {
      return [];
    }

    return [{ name, value }];
  });
}

function parseMetadata(value: unknown): GmailMetadataPayload {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error("Invalid Gmail metadata response payload.");
  }

  const id = asNonEmptyString(payload.id);
  if (!id) {
    throw new Error("Invalid Gmail metadata response payload: id is required.");
  }

  const metadataPayloadValue = payload.payload;
  const metadataPayload =
    metadataPayloadValue === undefined ? null : asRecord(metadataPayloadValue);
  if (metadataPayloadValue !== undefined && !metadataPayload) {
    throw new Error(
      "Invalid Gmail metadata response payload: payload must be an object."
    );
  }

  return {
    id,
    snippet: asString(payload.snippet) ?? "",
    internalDate: parseInternalDate(payload.internalDate),
    headers: parseHeaders(metadataPayload),
  };
}

function defaultSince(now: Date) {
  return new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

function parseCursorDate(value: string | undefined, now: Date): Date {
  if (!value) {
    return defaultSince(now);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return defaultSince(now);
  }

  return parsed;
}

function parseCursor(cursor: string | undefined, now: Date): GmailCursorState {
  if (!cursor) {
    return {
      historyId: null,
      since: defaultSince(now),
    };
  }

  const normalized = cursor.trim();
  if (!normalized) {
    return {
      historyId: null,
      since: defaultSince(now),
    };
  }

  if (normalized.startsWith(GMAIL_HISTORY_CURSOR_PREFIX)) {
    const historyId = asNonEmptyString(
      normalized.slice(GMAIL_HISTORY_CURSOR_PREFIX.length)
    );

    return {
      historyId,
      since: defaultSince(now),
    };
  }

  if (normalized.startsWith(GMAIL_TIME_CURSOR_PREFIX)) {
    return {
      historyId: null,
      since: parseCursorDate(
        normalized.slice(GMAIL_TIME_CURSOR_PREFIX.length),
        now
      ),
    };
  }

  return {
    historyId: null,
    since: parseCursorDate(normalized, now),
  };
}

function toHistoryCursor(historyId: string): string {
  return `${GMAIL_HISTORY_CURSOR_PREFIX}${historyId}`;
}

function toTimeCursor(isoDate: string): string {
  return `${GMAIL_TIME_CURSOR_PREFIX}${isoDate}`;
}

function toEpochSeconds(value: Date) {
  return Math.max(0, Math.floor(value.getTime() / 1000));
}

function parseHistoryMessageIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const payload = asRecord(entry);
    if (!payload) {
      return [];
    }

    const message = asRecord(payload.message);
    const messageId =
      asNonEmptyString(message?.id) ?? asNonEmptyString(payload.id);
    if (!messageId) {
      return [];
    }

    return [messageId];
  });
}

function parseHistory(value: unknown): GmailHistoryPayload {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error("Invalid Gmail history response payload.");
  }

  const historyId = asNonEmptyString(payload.historyId);
  const historyItems = payload.history;
  if (historyItems === undefined) {
    return { messageIds: [], historyId };
  }

  if (!Array.isArray(historyItems)) {
    throw new Error(
      "Invalid Gmail history response payload: history must be an array."
    );
  }

  const messageIds = new Set<string>();

  for (const entry of historyItems) {
    const item = asRecord(entry);
    if (!item) {
      continue;
    }

    for (const messageId of parseHistoryMessageIds(item.messagesAdded)) {
      messageIds.add(messageId);
    }

    for (const messageId of parseHistoryMessageIds(item.labelsAdded)) {
      messageIds.add(messageId);
    }

    for (const messageId of parseHistoryMessageIds(item.labelsRemoved)) {
      messageIds.add(messageId);
    }

    for (const messageId of parseHistoryMessageIds(item.messages)) {
      messageIds.add(messageId);
    }
  }

  return {
    messageIds: Array.from(messageIds),
    historyId,
  };
}

function parseProfile(value: unknown): GmailProfilePayload {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error("Invalid Gmail profile response payload.");
  }

  return {
    historyId: asNonEmptyString(payload.historyId),
  };
}

async function fetchGoogleJson(
  url: string,
  accessToken: string
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw googleApiError(response.status, detail.slice(0, 240));
  }

  return response.json();
}

function isExpiredHistoryCursorError(error: unknown): boolean {
  if (!isGoogleApiError(error)) {
    return false;
  }

  if (error.status !== 404 && error.status !== 400) {
    return false;
  }

  const detail = error.detail.toLowerCase();
  return (
    detail.includes("history") ||
    detail.includes("starthistoryid") ||
    detail.includes("not found")
  );
}

async function listMessagesSince(
  accessToken: string,
  since: Date,
  maxResults: number
): Promise<string[]> {
  const query = `in:inbox -category:promotions after:${toEpochSeconds(since)}`;

  const listParams = new URLSearchParams({
    maxResults: String(Math.max(1, Math.min(maxResults, 50))),
    q: query,
  });

  const list = parseList(
    await fetchGoogleJson(
      `${GOOGLE_GMAIL_API}/messages?${listParams.toString()}`,
      accessToken
    )
  );

  return list.messages.map((message) => message.id);
}

async function listMessagesFromHistory(
  accessToken: string,
  historyId: string,
  maxResults: number
): Promise<GmailHistoryPayload> {
  const params = new URLSearchParams({
    startHistoryId: historyId,
    maxResults: String(Math.max(1, Math.min(maxResults * 5, 500))),
  });
  params.append("historyTypes", "messageAdded");
  params.append("historyTypes", "labelsAdded");
  params.append("historyTypes", "labelsRemoved");

  return parseHistory(
    await fetchGoogleJson(
      `${GOOGLE_GMAIL_API}/history?${params.toString()}`,
      accessToken
    )
  );
}

async function fetchLatestHistoryId(
  accessToken: string
): Promise<string | null> {
  const profile = parseProfile(
    await fetchGoogleJson(`${GOOGLE_GMAIL_API}/profile`, accessToken)
  );

  return profile.historyId;
}

function readHeader(headers: GmailHeader[], headerName: string) {
  const target = headerName.toLowerCase();

  for (const header of headers) {
    if (header.name.toLowerCase() === target) {
      return header.value.trim();
    }
  }

  return "";
}

function extractActor(fromHeader: string): string | null {
  const trimmed = fromHeader.trim();
  if (!trimmed) {
    return null;
  }

  const nameMatch = trimmed.match(/^(?:"?([^"<]+)"?\s*)?<[^>]+>$/);
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

function normalizeSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function inferImpactScore(
  subject: string,
  snippet: string,
  intent: "draft_reply" | "refund_request"
) {
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

function inferRequiresDecision({
  intent,
  subject,
  snippet,
  watchMatched,
  relationshipScore,
  impactScore,
}: {
  intent: "draft_reply" | "refund_request";
  subject: string;
  snippet: string;
  watchMatched: boolean;
  relationshipScore: number;
  impactScore: number;
}) {
  if (intent === "refund_request") {
    return true;
  }

  if (watchMatched) {
    return true;
  }

  if (relationshipScore >= 0.82 || impactScore >= 0.76) {
    return true;
  }

  const haystack = `${subject} ${snippet}`.toLowerCase();
  return (
    haystack.includes("urgent") ||
    haystack.includes("blocked") ||
    haystack.includes("deadline") ||
    haystack.includes("contract")
  );
}

function toSignal(
  snapshot: GmailThreadSnapshot,
  watchKeywords: string[],
  now: Date
): IntakeSignal {
  const intent = inferIntent(snapshot.subject, snapshot.snippet);
  const relationshipScore = inferRelationshipScore(snapshot.subject, snapshot.from);
  const impactScore = inferImpactScore(snapshot.subject, snapshot.snippet, intent);
  const haystack = `${snapshot.subject} ${snapshot.snippet}`.toLowerCase();
  const watchMatched = watchKeywords.some((keyword) =>
    haystack.includes(keyword.toLowerCase())
  );
  const requiresDecision = inferRequiresDecision({
    intent,
    subject: snapshot.subject,
    snippet: snapshot.snippet,
    watchMatched,
    relationshipScore,
    impactScore,
  });

  return {
    id: `gmail:${snapshot.id}`,
    source: "Gmail",
    actor: snapshot.from,
    summary: snapshot.subject || "Untitled email",
    context: snapshot.snippet || "No email snippet available.",
    preview:
      snapshot.snippet || snapshot.subject || "Open in Gmail for full content.",
    intent,
    requiresDecision,
    deadlineAt: inferDeadline(intent, now),
    relationshipScore,
    impactScore,
    watchMatched,
  };
}

async function fetchMessageSnapshot(
  accessToken: string,
  messageId: string,
  now: Date
): Promise<GmailThreadSnapshot | null> {
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: "From",
  });
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "Date");

  const metadata = parseMetadata(
    await fetchGoogleJson(
      `${GOOGLE_GMAIL_API}/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
      accessToken
    )
  );

  const fromHeader = readHeader(metadata.headers, "From");
  const actor = extractActor(fromHeader);
  if (!actor) {
    return null;
  }

  const subjectHeader = readHeader(metadata.headers, "Subject");
  const receivedAt =
    metadata.internalDate === null
      ? now.toISOString()
      : new Date(metadata.internalDate).toISOString();

  return {
    id: metadata.id,
    from: actor,
    subject: subjectHeader || "Untitled message",
    snippet: normalizeSnippet(metadata.snippet),
    receivedAt,
  };
}

export function ingestGmailSignalsProgram({
  accessToken,
  cursor,
  now = new Date(),
  watchKeywords = [],
  maxResults = 20,
}: GmailIngestionInput) {
  return Effect.gen(function* () {
    const cursorState = parseCursor(cursor, now);

    let messageIds: string[] = [];
    let historyId = cursorState.historyId;

    if (cursorState.historyId) {
      const historyAttempt = yield* Effect.either(
        Effect.tryPromise(() =>
          listMessagesFromHistory(
            accessToken,
            cursorState.historyId!,
            maxResults
          )
        )
      );

      if (historyAttempt._tag === "Right") {
        messageIds = historyAttempt.right.messageIds;
        historyId = historyAttempt.right.historyId ?? cursorState.historyId;
      } else if (isExpiredHistoryCursorError(historyAttempt.left)) {
        messageIds = yield* Effect.tryPromise(() =>
          listMessagesSince(accessToken, cursorState.since, maxResults)
        );
        historyId = null;
      } else {
        return yield* Effect.fail(historyAttempt.left);
      }
    } else {
      messageIds = yield* Effect.tryPromise(() =>
        listMessagesSince(accessToken, cursorState.since, maxResults)
      );
    }

    if (!historyId) {
      historyId = yield* Effect.tryPromise(() =>
        fetchLatestHistoryId(accessToken)
      );
    }

    const uniqueMessageIds = Array.from(new Set(messageIds));
    const boundedMessageIds = uniqueMessageIds.slice(
      0,
      Math.max(1, Math.min(maxResults * 5, 250))
    );

    if (boundedMessageIds.length === 0) {
      return {
        nextCursor: historyId
          ? toHistoryCursor(historyId)
          : toTimeCursor(now.toISOString()),
        signals: [],
      } satisfies GmailIngestionResult;
    }

    const snapshots = (yield* Effect.tryPromise(() =>
      Promise.all(
        boundedMessageIds.map((messageId) =>
          fetchMessageSnapshot(accessToken, messageId, now)
        )
      )
    )).filter((snapshot): snapshot is GmailThreadSnapshot => snapshot !== null);

    snapshots.sort(
      (left, right) =>
        new Date(right.receivedAt).getTime() -
        new Date(left.receivedAt).getTime()
    );

    return {
      nextCursor: historyId
        ? toHistoryCursor(historyId)
        : toTimeCursor(now.toISOString()),
      signals: snapshots.map((snapshot) =>
        toSignal(snapshot, watchKeywords, now)
      ),
    } satisfies GmailIngestionResult;
  });
}

export async function ingestGmailSignals(
  input: GmailIngestionInput
): Promise<GmailIngestionResult> {
  return runIntegrationsEffect(ingestGmailSignalsProgram(input));
}
