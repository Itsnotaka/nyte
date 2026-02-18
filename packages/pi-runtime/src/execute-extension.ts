import {
  EXTENSION_NAMES,
  type CalendarCreateEventRequest,
  type CalendarCreateEventResult,
  type CalendarUpdateEventRequest,
  type CalendarUpdateEventResult,
  type GmailReadThreadContextRequest,
  type GmailReadThreadContextResult,
  type GmailSaveDraftRequest,
  type GmailSaveDraftResult,
  type ExtensionRequest,
  type ExtensionResult,
} from "./contracts";
import { extensionRegistry } from "./registry";

export async function executeExtension(
  request: GmailReadThreadContextRequest
): Promise<GmailReadThreadContextResult>;
export async function executeExtension(
  request: GmailSaveDraftRequest
): Promise<GmailSaveDraftResult>;
export async function executeExtension(
  request: CalendarCreateEventRequest
): Promise<CalendarCreateEventResult>;
export async function executeExtension(
  request: CalendarUpdateEventRequest
): Promise<CalendarUpdateEventResult>;
export async function executeExtension(
  request: ExtensionRequest
): Promise<ExtensionResult> {
  switch (request.name) {
    case EXTENSION_NAMES.gmailReadThreadContext:
      return extensionRegistry[EXTENSION_NAMES.gmailReadThreadContext](
        request
      );
    case EXTENSION_NAMES.gmailSaveDraft:
      return extensionRegistry[EXTENSION_NAMES.gmailSaveDraft](request);
    case EXTENSION_NAMES.calendarCreateEvent:
      return extensionRegistry[EXTENSION_NAMES.calendarCreateEvent](
        request
      );
    case EXTENSION_NAMES.calendarUpdateEvent:
      return extensionRegistry[EXTENSION_NAMES.calendarUpdateEvent](
        request
      );
  }
}
