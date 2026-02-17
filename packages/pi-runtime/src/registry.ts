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
import { PI_EXTENSION_NAMES } from "./contracts";
import { calendarCreateEvent, calendarUpdateEvent } from "./extensions/calendar";
import { gmailReadThreadContext, gmailSaveDraft } from "./extensions/gmail";

type PiExtensionRegistry = {
  [PI_EXTENSION_NAMES.gmailReadThreadContext]: (
    request: GmailReadThreadContextRequest,
  ) => Promise<GmailReadThreadContextResult>;
  [PI_EXTENSION_NAMES.gmailSaveDraft]: (request: GmailSaveDraftRequest) => Promise<GmailSaveDraftResult>;
  [PI_EXTENSION_NAMES.calendarCreateEvent]: (
    request: CalendarCreateEventRequest,
  ) => Promise<CalendarCreateEventResult>;
  [PI_EXTENSION_NAMES.calendarUpdateEvent]: (
    request: CalendarUpdateEventRequest,
  ) => Promise<CalendarUpdateEventResult>;
};

export const piExtensionRegistry: PiExtensionRegistry = {
  [PI_EXTENSION_NAMES.gmailReadThreadContext]: gmailReadThreadContext,
  [PI_EXTENSION_NAMES.gmailSaveDraft]: gmailSaveDraft,
  [PI_EXTENSION_NAMES.calendarCreateEvent]: calendarCreateEvent,
  [PI_EXTENSION_NAMES.calendarUpdateEvent]: calendarUpdateEvent,
};
