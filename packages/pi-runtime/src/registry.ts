import type {
  CalendarCreateEventRequest,
  CalendarCreateEventResult,
  CalendarUpdateEventRequest,
  CalendarUpdateEventResult,
  GmailReadThreadContextRequest,
  GmailReadThreadContextResult,
  GmailSaveDraftRequest,
  GmailSaveDraftResult,
} from "./contracts";
import { calendarCreateEvent, calendarUpdateEvent } from "./extensions/calendar";
import { gmailReadThreadContext, gmailSaveDraft } from "./extensions/gmail";

type PiExtensionRegistry = {
  "gmail.readThreadContext": (
    request: GmailReadThreadContextRequest,
  ) => Promise<GmailReadThreadContextResult>;
  "gmail.saveDraft": (request: GmailSaveDraftRequest) => Promise<GmailSaveDraftResult>;
  "calendar.createEvent": (
    request: CalendarCreateEventRequest,
  ) => Promise<CalendarCreateEventResult>;
  "calendar.updateEvent": (
    request: CalendarUpdateEventRequest,
  ) => Promise<CalendarUpdateEventResult>;
};

export const piExtensionRegistry: PiExtensionRegistry = {
  "gmail.readThreadContext": gmailReadThreadContext,
  "gmail.saveDraft": gmailSaveDraft,
  "calendar.createEvent": calendarCreateEvent,
  "calendar.updateEvent": calendarUpdateEvent,
};
