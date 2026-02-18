import type { IntakeSignal } from "@nyte/domain/triage";

const GOOGLE_CALENDAR_API =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEFAULT_LOOKBACK_DAYS = 7;
const CALENDAR_SYNC_CURSOR_PREFIX = "sync:";
const CALENDAR_TIME_CURSOR_PREFIX = "time:";
const MAX_CALENDAR_SYNC_PAGES = 25;

type CalendarCursorState = {
  syncToken: string | null;
  since: Date;
};

type CalendarResponseStatus =
  | "needsAction"
  | "accepted"
  | "declined"
  | "tentative";

type CalendarOrganizer = {
  displayName: string | null;
  email: string | null;
  self: boolean;
};

type CalendarAttendee = {
  self: boolean;
  displayName: string | null;
  email: string | null;
  responseStatus: CalendarResponseStatus | null;
};

type CalendarEvent = {
  id: string;
  status: string;
  summary: string;
  description: string;
  organizer: CalendarOrganizer;
  attendees: CalendarAttendee[];
  startsAt: string;
};

type GoogleCalendarEventsPayload = {
  items: CalendarEvent[];
  nextPageToken: string | null;
  nextSyncToken: string | null;
};

export type CalendarPollingInput = {
  accessToken: string;
  cursor?: string;
  now?: Date;
  watchKeywords?: string[];
  maxResults?: number;
};

export type CalendarPollingResult = {
  nextCursor: string;
  signals: IntakeSignal[];
};

class GoogleApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(
      `Google Calendar API request failed with status ${status}: ${detail}`
    );
    this.name = "GoogleApiError";
    this.status = status;
    this.detail = detail;
  }
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

function asBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") {
    return null;
  }

  return value;
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

function parseCursor(
  cursor: string | undefined,
  now: Date
): CalendarCursorState {
  if (!cursor) {
    return {
      syncToken: null,
      since: defaultSince(now),
    };
  }

  const normalized = cursor.trim();
  if (!normalized) {
    return {
      syncToken: null,
      since: defaultSince(now),
    };
  }

  if (normalized.startsWith(CALENDAR_SYNC_CURSOR_PREFIX)) {
    const syncToken = asNonEmptyString(
      normalized.slice(CALENDAR_SYNC_CURSOR_PREFIX.length)
    );

    return {
      syncToken,
      since: defaultSince(now),
    };
  }

  if (normalized.startsWith(CALENDAR_TIME_CURSOR_PREFIX)) {
    return {
      syncToken: null,
      since: parseCursorDate(
        normalized.slice(CALENDAR_TIME_CURSOR_PREFIX.length),
        now
      ),
    };
  }

  return {
    syncToken: null,
    since: parseCursorDate(normalized, now),
  };
}

function toSyncCursor(syncToken: string): string {
  return `${CALENDAR_SYNC_CURSOR_PREFIX}${syncToken}`;
}

function toTimeCursor(isoDate: string): string {
  return `${CALENDAR_TIME_CURSOR_PREFIX}${isoDate}`;
}

function truncate(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function parseDate(value: unknown): string | null {
  const text = asNonEmptyString(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function parseOrganizer(value: unknown): CalendarOrganizer | null {
  const organizer = asRecord(value);
  if (!organizer) {
    return null;
  }

  const displayName = asNonEmptyString(organizer.displayName);
  const email = asNonEmptyString(organizer.email);
  if (!displayName && !email) {
    return null;
  }

  return {
    displayName,
    email,
    self: asBoolean(organizer.self) ?? false,
  };
}

function parseResponseStatus(value: unknown): CalendarResponseStatus | null {
  if (value === "needsAction") {
    return value;
  }

  if (value === "accepted") {
    return value;
  }

  if (value === "declined") {
    return value;
  }

  if (value === "tentative") {
    return value;
  }

  return null;
}

function parseAttendees(value: unknown): CalendarAttendee[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      "Invalid Google Calendar event payload: attendees must be an array."
    );
  }

  return value.flatMap((entry) => {
    const attendee = asRecord(entry);
    if (!attendee) {
      return [];
    }

    return [
      {
        self: asBoolean(attendee.self) ?? false,
        displayName: asNonEmptyString(attendee.displayName),
        email: asNonEmptyString(attendee.email),
        responseStatus: parseResponseStatus(attendee.responseStatus),
      },
    ];
  });
}

function parseStart(value: unknown): string | null {
  const start = asRecord(value);
  if (!start) {
    return null;
  }

  return parseDate(start.dateTime) ?? parseDate(start.date);
}

function parseEvent(value: unknown): CalendarEvent | null {
  const event = asRecord(value);
  if (!event) {
    return null;
  }

  const id = asNonEmptyString(event.id);
  if (!id) {
    return null;
  }

  const organizer = parseOrganizer(event.organizer);
  if (!organizer) {
    return null;
  }

  const startsAt = parseStart(event.start);
  if (!startsAt) {
    return null;
  }

  return {
    id,
    status: asNonEmptyString(event.status) ?? "confirmed",
    summary: asNonEmptyString(event.summary) ?? "Untitled event",
    description: asString(event.description) ?? "",
    organizer,
    attendees: parseAttendees(event.attendees),
    startsAt,
  };
}

function parseEvents(value: unknown): GoogleCalendarEventsPayload {
  const payload = asRecord(value);
  if (!payload) {
    throw new Error("Invalid Google Calendar events response payload.");
  }

  const rawItems = payload.items;
  if (rawItems !== undefined && !Array.isArray(rawItems)) {
    throw new Error(
      "Invalid Google Calendar events response payload: items must be an array."
    );
  }

  return {
    items: (rawItems ?? [])
      .map((entry) => parseEvent(entry))
      .filter((entry): entry is CalendarEvent => entry !== null),
    nextPageToken: asNonEmptyString(payload.nextPageToken),
    nextSyncToken: asNonEmptyString(payload.nextSyncToken),
  };
}

function actorFromEvent(event: CalendarEvent) {
  if (event.organizer.displayName) {
    return event.organizer.displayName;
  }

  if (!event.organizer.email) {
    throw new Error("Google Calendar event organizer is required.");
  }

  const email = event.organizer.email;
  return (
    email
      .split("@")
      .at(0)
      ?.replace(/[._-]+/g, " ")
      .trim() ?? email
  );
}

function hasPendingResponse(event: CalendarEvent) {
  const selfAttendee = event.attendees.find((attendee) => attendee.self);
  if (!selfAttendee) {
    return event.organizer.self !== true;
  }

  return (
    selfAttendee.responseStatus === "needsAction" ||
    selfAttendee.responseStatus === "tentative"
  );
}

function inferRelationshipScore(actor: string, summary: string) {
  const haystack = `${actor} ${summary}`.toLowerCase();
  if (
    haystack.includes("board") ||
    haystack.includes("exec") ||
    haystack.includes("investor")
  ) {
    return 0.88;
  }

  return 0.69;
}

function inferImpactScore(summary: string, description: string) {
  const haystack = `${summary} ${description}`.toLowerCase();
  if (
    haystack.includes("board") ||
    haystack.includes("quarterly") ||
    haystack.includes("customer")
  ) {
    return 0.79;
  }

  return 0.62;
}

function toSignal(
  event: CalendarEvent,
  watchKeywords: string[]
): IntakeSignal | null {
  if (event.status === "cancelled") {
    return null;
  }

  if (!hasPendingResponse(event)) {
    return null;
  }

  const actor = actorFromEvent(event);
  const description = truncate(event.description, 220);
  const haystack = `${event.summary} ${description} ${actor}`.toLowerCase();
  const watchMatched = watchKeywords.some((keyword) =>
    haystack.includes(keyword.toLowerCase())
  );

  return {
    id: `gcal:${event.id}`,
    source: "Google Calendar",
    actor,
    summary: `${actor} invited you to ${event.summary}.`,
    context: description || "No event description provided.",
    preview: `Proposed start ${new Date(event.startsAt).toLocaleString()}`,
    intent: "schedule_event",
    requiresDecision: true,
    deadlineAt: event.startsAt,
    relationshipScore: inferRelationshipScore(actor, event.summary),
    impactScore: inferImpactScore(event.summary, description),
    watchMatched,
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
    throw new GoogleApiError(response.status, detail.slice(0, 240));
  }

  return response.json();
}

function isExpiredSyncTokenError(error: unknown): boolean {
  if (!(error instanceof GoogleApiError)) {
    return false;
  }

  if (error.status === 410) {
    return true;
  }

  const detail = error.detail.toLowerCase();
  return detail.includes("fullsyncrequired") || detail.includes("sync token");
}

async function listEventsWithCursor({
  accessToken,
  maxResults,
  since,
  syncToken,
}: {
  accessToken: string;
  maxResults: number;
  since: Date;
  syncToken: string | null;
}): Promise<{ items: CalendarEvent[]; nextSyncToken: string | null }> {
  const limit = String(Math.max(1, Math.min(maxResults, 250)));
  const items: CalendarEvent[] = [];
  let nextPageToken: string | null = null;
  let nextSyncToken: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_CALENDAR_SYNC_PAGES; pageIndex += 1) {
    const params = new URLSearchParams({
      maxResults: limit,
      singleEvents: "true",
    });

    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      params.set("orderBy", "startTime");
      params.set("timeMin", since.toISOString());
    }

    if (nextPageToken) {
      params.set("pageToken", nextPageToken);
    }

    const payload = parseEvents(
      await fetchGoogleJson(
        `${GOOGLE_CALENDAR_API}?${params.toString()}`,
        accessToken
      )
    );

    items.push(...payload.items);
    nextPageToken = payload.nextPageToken;
    nextSyncToken = payload.nextSyncToken;

    if (!nextPageToken) {
      break;
    }
  }

  if (nextPageToken) {
    throw new Error("Google Calendar sync exceeded page limit.");
  }

  return { items, nextSyncToken };
}

export async function pollGoogleCalendarIngestion({
  accessToken,
  cursor,
  now = new Date(),
  watchKeywords = [],
  maxResults = 20,
}: CalendarPollingInput): Promise<CalendarPollingResult> {
  const cursorState = parseCursor(cursor, now);

  let events: CalendarEvent[] = [];
  let nextSyncToken: string | null = null;

  if (cursorState.syncToken) {
    try {
      const incremental = await listEventsWithCursor({
        accessToken,
        maxResults,
        since: cursorState.since,
        syncToken: cursorState.syncToken,
      });
      events = incremental.items;
      nextSyncToken = incremental.nextSyncToken ?? cursorState.syncToken;
    } catch (error) {
      if (!isExpiredSyncTokenError(error)) {
        throw error;
      }

      const baseline = await listEventsWithCursor({
        accessToken,
        maxResults,
        since: cursorState.since,
        syncToken: null,
      });
      events = baseline.items;
      nextSyncToken = baseline.nextSyncToken;
    }
  } else {
    const baseline = await listEventsWithCursor({
      accessToken,
      maxResults,
      since: cursorState.since,
      syncToken: null,
    });
    events = baseline.items;
    nextSyncToken = baseline.nextSyncToken;
  }

  const signals = events
    .map((event) => toSignal(event, watchKeywords))
    .filter((signal): signal is IntakeSignal => signal !== null);

  return {
    nextCursor: nextSyncToken
      ? toSyncCursor(nextSyncToken)
      : toTimeCursor(now.toISOString()),
    signals,
  };
}
