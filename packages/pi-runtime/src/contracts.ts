import type {
  GmailCreateDraftToolCall,
  GoogleCalendarCreateEventToolCall,
} from "@nyte/domain/actions";

export const PI_EXTENSION_NAMES = {
  gmailReadThreadContext: "gmail.readThreadContext",
  gmailSaveDraft: "gmail.saveDraft",
  calendarCreateEvent: "calendar.createEvent",
  calendarUpdateEvent: "calendar.updateEvent",
} as const;

export type PiExtensionName =
  (typeof PI_EXTENSION_NAMES)[keyof typeof PI_EXTENSION_NAMES];
const PI_EXTENSION_NAME_SET = new Set<PiExtensionName>(
  Object.values(PI_EXTENSION_NAMES)
);

export const PI_AUDIT_SOURCES = {
  decisionQueue: "decision-queue",
} as const;

export const PI_AUTH_PROVIDERS = {
  google: "google",
} as const;

export type PiAuthProvider =
  (typeof PI_AUTH_PROVIDERS)[keyof typeof PI_AUTH_PROVIDERS];

export const PI_AUTH_SCOPES = {
  googleWorkspace: [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/calendar.events",
  ],
} as const;

type PiAuthScope = {
  provider: PiAuthProvider;
  userId: string | null;
  scopes: string[];
};

type PiAuditPayload = {
  workItemId: string;
  actionId: string;
  source: (typeof PI_AUDIT_SOURCES)[keyof typeof PI_AUDIT_SOURCES];
};

type BaseExtensionRequest = {
  auth: PiAuthScope;
  idempotencyKey: string;
  audit: PiAuditPayload;
};

export type GmailReadThreadContextRequest = BaseExtensionRequest & {
  name: typeof PI_EXTENSION_NAMES.gmailReadThreadContext;
  input: {
    threadId: string;
  };
};

export type GmailSaveDraftRequest = BaseExtensionRequest & {
  name: typeof PI_EXTENSION_NAMES.gmailSaveDraft;
  input: GmailCreateDraftToolCall;
};

export type CalendarCreateEventRequest = BaseExtensionRequest & {
  name: typeof PI_EXTENSION_NAMES.calendarCreateEvent;
  input: GoogleCalendarCreateEventToolCall;
};

export type CalendarUpdateEventRequest = BaseExtensionRequest & {
  name: typeof PI_EXTENSION_NAMES.calendarUpdateEvent;
  input: {
    eventId: string;
    title?: string;
    startsAt?: string;
    endsAt?: string;
    description?: string;
  };
};

export type PiExtensionRequest =
  | GmailReadThreadContextRequest
  | GmailSaveDraftRequest
  | CalendarCreateEventRequest
  | CalendarUpdateEventRequest;

type BaseExtensionResult<TName extends PiExtensionName, TOutput> = {
  name: TName;
  status: "executed";
  idempotencyKey: string;
  output: TOutput;
  executedAt: string;
};

export type GmailReadThreadContextResult = BaseExtensionResult<
  typeof PI_EXTENSION_NAMES.gmailReadThreadContext,
  {
    threadId: string;
    contextPreview: string;
  }
>;

export type GmailSaveDraftResult = BaseExtensionResult<
  typeof PI_EXTENSION_NAMES.gmailSaveDraft,
  {
    providerDraftId: string;
    subject: string;
  }
>;

export type CalendarCreateEventResult = BaseExtensionResult<
  typeof PI_EXTENSION_NAMES.calendarCreateEvent,
  {
    providerEventId: string;
    startsAt: string;
    endsAt: string;
  }
>;

export type CalendarUpdateEventResult = BaseExtensionResult<
  typeof PI_EXTENSION_NAMES.calendarUpdateEvent,
  {
    providerEventId: string;
    updated: true;
  }
>;

export type PiExtensionResult =
  | GmailReadThreadContextResult
  | GmailSaveDraftResult
  | CalendarCreateEventResult
  | CalendarUpdateEventResult;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPiExtensionName(value: unknown): value is PiExtensionName {
  return (
    typeof value === "string" &&
    PI_EXTENSION_NAME_SET.has(value as PiExtensionName)
  );
}

export function isPiExtensionResult(
  value: unknown
): value is PiExtensionResult {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    isPiExtensionName(payload.name) &&
    payload.status === "executed" &&
    isNonEmptyString(payload.idempotencyKey) &&
    isNonEmptyString(payload.executedAt) &&
    asRecord(payload.output) !== null
  );
}
