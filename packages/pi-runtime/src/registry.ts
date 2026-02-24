import type {
  ExtensionName,
  ExtensionRequestByName,
  ExtensionResultByName,
} from "./contracts";
import { EXTENSION_NAMES } from "./contracts";
import {
  calendarCreateEvent,
  calendarUpdateEvent,
} from "./extensions/calendar";
import { gmailReadThreadContext, gmailSend } from "./extensions/gmail";

type ExtensionRegistry = {
  [Name in ExtensionName]: (
    request: ExtensionRequestByName[Name]
  ) => Promise<ExtensionResultByName[Name]>;
};

export const extensionRegistry: ExtensionRegistry = {
  [EXTENSION_NAMES.gmailReadThreadContext]: gmailReadThreadContext,
  [EXTENSION_NAMES.gmailSend]: gmailSend,
  [EXTENSION_NAMES.calendarCreateEvent]: calendarCreateEvent,
  [EXTENSION_NAMES.calendarUpdateEvent]: calendarUpdateEvent,
};
