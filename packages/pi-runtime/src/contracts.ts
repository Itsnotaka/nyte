import type {
  GmailCreateDraftToolCall,
  GoogleCalendarCreateEventToolCall,
} from "@nyte/domain/actions";

export const EXTENSION_NAMES = {
  gmailReadThreadContext: "gmail.readThreadContext",
  gmailSaveDraft: "gmail.saveDraft",
  calendarCreateEvent: "calendar.createEvent",
  calendarUpdateEvent: "calendar.updateEvent",
} as const;

export type ExtensionName =
  (typeof EXTENSION_NAMES)[keyof typeof EXTENSION_NAMES];
const EXTENSION_NAME_SET = new Set<ExtensionName>(
  Object.values(EXTENSION_NAMES)
);

export const EXTENSION_AUDIT_SOURCES = {
  decisionQueue: "decision-queue",
} as const;

export const EXTENSION_AUTH_PROVIDERS = {
  google: "google",
} as const;

export type ExtensionAuthProvider =
  (typeof EXTENSION_AUTH_PROVIDERS)[keyof typeof EXTENSION_AUTH_PROVIDERS];

export const EXTENSION_AUTH_SCOPES = {
  googleWorkspace: [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/calendar.events",
  ],
} as const;

export type ExtensionAuth = {
  provider: ExtensionAuthProvider;
  userId: string | null;
  scopes: string[];
};

export type ExtensionAudit = {
  workItemId: string;
  actionId: string;
  source: (typeof EXTENSION_AUDIT_SOURCES)[keyof typeof EXTENSION_AUDIT_SOURCES];
};

export type ExtensionExecutionContext = {
  auth: ExtensionAuth;
  idempotencyKey: string;
  audit: ExtensionAudit;
};

export type GmailReadThreadContextRequest = ExtensionExecutionContext & {
  name: typeof EXTENSION_NAMES.gmailReadThreadContext;
  input: {
    threadId: string;
  };
};

export type GmailSaveDraftRequest = ExtensionExecutionContext & {
  name: typeof EXTENSION_NAMES.gmailSaveDraft;
  input: GmailCreateDraftToolCall;
};

export type CalendarCreateEventRequest = ExtensionExecutionContext & {
  name: typeof EXTENSION_NAMES.calendarCreateEvent;
  input: GoogleCalendarCreateEventToolCall;
};

export type CalendarUpdateEventRequest = ExtensionExecutionContext & {
  name: typeof EXTENSION_NAMES.calendarUpdateEvent;
  input: {
    eventId: string;
    title?: string;
    startsAt?: string;
    endsAt?: string;
    description?: string;
  };
};

export type ExtensionRequestByName = {
  [EXTENSION_NAMES.gmailReadThreadContext]: GmailReadThreadContextRequest;
  [EXTENSION_NAMES.gmailSaveDraft]: GmailSaveDraftRequest;
  [EXTENSION_NAMES.calendarCreateEvent]: CalendarCreateEventRequest;
  [EXTENSION_NAMES.calendarUpdateEvent]: CalendarUpdateEventRequest;
};

export type ExtensionRequest = ExtensionRequestByName[ExtensionName];

type BaseExtensionResult<TName extends ExtensionName, TOutput> = {
  name: TName;
  status: "executed";
  idempotencyKey: string;
  output: TOutput;
  executedAt: string;
};

export type GmailReadThreadContextResult = BaseExtensionResult<
  typeof EXTENSION_NAMES.gmailReadThreadContext,
  {
    threadId: string;
    contextPreview: string;
  }
>;

export type GmailSaveDraftResult = BaseExtensionResult<
  typeof EXTENSION_NAMES.gmailSaveDraft,
  {
    providerDraftId: string;
    subject: string;
  }
>;

export type CalendarCreateEventResult = BaseExtensionResult<
  typeof EXTENSION_NAMES.calendarCreateEvent,
  {
    providerEventId: string;
    startsAt: string;
    endsAt: string;
  }
>;

export type CalendarUpdateEventResult = BaseExtensionResult<
  typeof EXTENSION_NAMES.calendarUpdateEvent,
  {
    providerEventId: string;
    updated: true;
  }
>;

export type ExtensionResultByName = {
  [EXTENSION_NAMES.gmailReadThreadContext]: GmailReadThreadContextResult;
  [EXTENSION_NAMES.gmailSaveDraft]: GmailSaveDraftResult;
  [EXTENSION_NAMES.calendarCreateEvent]: CalendarCreateEventResult;
  [EXTENSION_NAMES.calendarUpdateEvent]: CalendarUpdateEventResult;
};

export type ExtensionResult = ExtensionResultByName[ExtensionName];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isExtensionName(value: unknown): value is ExtensionName {
  return (
    typeof value === "string" && EXTENSION_NAME_SET.has(value as ExtensionName)
  );
}

export function isExtensionResult(value: unknown): value is ExtensionResult {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    isExtensionName(payload.name) &&
    payload.status === "executed" &&
    isNonEmptyString(payload.idempotencyKey) &&
    isNonEmptyString(payload.executedAt) &&
    asRecord(payload.output) !== null
  );
}
