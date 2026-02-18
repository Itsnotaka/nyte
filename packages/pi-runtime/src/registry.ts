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
import { EXTENSION_NAMES } from "./contracts";
import {
  calendarCreateEvent,
  calendarUpdateEvent,
} from "./extensions/calendar";
import { gmailReadThreadContext, gmailSaveDraft } from "./extensions/gmail";

type ExtensionRegistry = {
  [EXTENSION_NAMES.gmailReadThreadContext]: (
    request: GmailReadThreadContextRequest
  ) => Promise<GmailReadThreadContextResult>;
  [EXTENSION_NAMES.gmailSaveDraft]: (
    request: GmailSaveDraftRequest
  ) => Promise<GmailSaveDraftResult>;
  [EXTENSION_NAMES.calendarCreateEvent]: (
    request: CalendarCreateEventRequest
  ) => Promise<CalendarCreateEventResult>;
  [EXTENSION_NAMES.calendarUpdateEvent]: (
    request: CalendarUpdateEventRequest
  ) => Promise<CalendarUpdateEventResult>;
};

export const extensionRegistry: ExtensionRegistry = {
  [EXTENSION_NAMES.gmailReadThreadContext]: gmailReadThreadContext,
  [EXTENSION_NAMES.gmailSaveDraft]: gmailSaveDraft,
  [EXTENSION_NAMES.calendarCreateEvent]: calendarCreateEvent,
  [EXTENSION_NAMES.calendarUpdateEvent]: calendarUpdateEvent,
};
