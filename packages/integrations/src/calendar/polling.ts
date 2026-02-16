import type { IntakeSignal } from "@nyte/domain/triage";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DEFAULT_LOOKBACK_DAYS = 7;

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

type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  organizer?: {
    displayName?: string;
    email?: string;
    self?: boolean;
  };
  attendees?: Array<{
    self?: boolean;
    displayName?: string;
    email?: string;
    responseStatus?: "needsAction" | "accepted" | "declined" | "tentative";
  }>;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
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

function normalizeDateTime(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback.toISOString();
  }

  return parsed.toISOString();
}

function truncate(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function actorFromEvent(event: GoogleCalendarEvent) {
  const organizerName = event.organizer?.displayName?.trim();
  if (organizerName) {
    return organizerName;
  }

  const organizerEmail = event.organizer?.email?.trim();
  if (organizerEmail) {
    return organizerEmail.split("@").at(0)?.replace(/[._-]+/g, " ").trim() ?? organizerEmail;
  }

  return "Calendar organizer";
}

function hasPendingResponse(event: GoogleCalendarEvent) {
  const selfAttendee = event.attendees?.find((attendee) => attendee.self);
  if (selfAttendee) {
    return selfAttendee.responseStatus === "needsAction" || selfAttendee.responseStatus === "tentative";
  }

  return event.organizer?.self !== true;
}

function inferRelationshipScore(actor: string, summary: string) {
  const haystack = `${actor} ${summary}`.toLowerCase();
  if (haystack.includes("board") || haystack.includes("exec") || haystack.includes("investor")) {
    return 0.88;
  }

  return 0.69;
}

function inferImpactScore(summary: string, description: string) {
  const haystack = `${summary} ${description}`.toLowerCase();
  if (haystack.includes("board") || haystack.includes("quarterly") || haystack.includes("customer")) {
    return 0.79;
  }

  return 0.62;
}

function toSignal(
  event: GoogleCalendarEvent,
  watchKeywords: string[],
  now: Date,
): IntakeSignal | null {
  if (event.status === "cancelled") {
    return null;
  }

  if (!hasPendingResponse(event)) {
    return null;
  }

  const startsAt = normalizeDateTime(event.start?.dateTime ?? event.start?.date, now);
  const summary = event.summary?.trim() || "Untitled event";
  const actor = actorFromEvent(event);
  const description = truncate(event.description ?? "", 220);
  const haystack = `${summary} ${description} ${actor}`.toLowerCase();
  const watchMatched = watchKeywords.some((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );

  return {
    id: `gcal:${event.id}`,
    source: "Google Calendar",
    actor,
    summary: `${actor} invited you to ${summary}.`,
    context: description || "No event description provided.",
    preview: `Proposed start ${new Date(startsAt).toLocaleString()}`,
    intent: "schedule_event",
    requiresDecision: true,
    deadlineAt: startsAt,
    relationshipScore: inferRelationshipScore(actor, summary),
    impactScore: inferImpactScore(summary, description),
    watchMatched,
  };
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
    throw new Error(
      `Google Calendar API request failed with status ${response.status}: ${detail.slice(0, 240)}`,
    );
  }

  return (await response.json()) as T;
}

export async function pollGoogleCalendarIngestion({
  accessToken,
  cursor,
  now = new Date(),
  watchKeywords = [],
  maxResults = 20,
}: CalendarPollingInput): Promise<CalendarPollingResult> {
  const since = normalizeCursor(cursor, now);
  const params = new URLSearchParams({
    maxResults: String(Math.max(1, Math.min(maxResults, 50))),
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: since.toISOString(),
  });

  if (cursor) {
    params.set("updatedMin", since.toISOString());
  }

  const result = await fetchGoogleJson<GoogleCalendarEventsResponse>(
    `${GOOGLE_CALENDAR_API}?${params.toString()}`,
    accessToken,
  );

  const signals: IntakeSignal[] = [];
  for (const event of result.items ?? []) {
    const signal = toSignal(event, watchKeywords, now);
    if (signal) {
      signals.push(signal);
    }
  }

  return {
    nextCursor: now.toISOString(),
    signals,
  };
}
