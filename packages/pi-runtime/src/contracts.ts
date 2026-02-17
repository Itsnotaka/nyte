import type { GmailCreateDraftToolCall, GoogleCalendarCreateEventToolCall } from "@nyte/domain/actions";

export type PiExtensionName =
  | "gmail.readThreadContext"
  | "gmail.saveDraft"
  | "calendar.createEvent"
  | "calendar.updateEvent";

type PiAuthScope = {
  provider: "google";
  userId: string | null;
  scopes: string[];
};

type PiAuditPayload = {
  workItemId: string;
  actionId: string;
  source: "decision-queue";
};

type BaseExtensionRequest = {
  auth: PiAuthScope;
  idempotencyKey: string;
  audit: PiAuditPayload;
};

export type GmailReadThreadContextRequest = BaseExtensionRequest & {
  name: "gmail.readThreadContext";
  input: {
    threadId: string;
  };
};

export type GmailSaveDraftRequest = BaseExtensionRequest & {
  name: "gmail.saveDraft";
  input: GmailCreateDraftToolCall;
};

export type CalendarCreateEventRequest = BaseExtensionRequest & {
  name: "calendar.createEvent";
  input: GoogleCalendarCreateEventToolCall;
};

export type CalendarUpdateEventRequest = BaseExtensionRequest & {
  name: "calendar.updateEvent";
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
  "gmail.readThreadContext",
  {
    threadId: string;
    contextPreview: string;
  }
>;

export type GmailSaveDraftResult = BaseExtensionResult<
  "gmail.saveDraft",
  {
    providerDraftId: string;
    subject: string;
  }
>;

export type CalendarCreateEventResult = BaseExtensionResult<
  "calendar.createEvent",
  {
    providerEventId: string;
    startsAt: string;
    endsAt: string;
  }
>;

export type CalendarUpdateEventResult = BaseExtensionResult<
  "calendar.updateEvent",
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
