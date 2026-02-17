import {
  PI_EXTENSION_NAMES,
  type CalendarCreateEventRequest,
  type CalendarCreateEventResult,
  type CalendarUpdateEventRequest,
  type CalendarUpdateEventResult,
  type GmailReadThreadContextRequest,
  type GmailReadThreadContextResult,
  type GmailSaveDraftRequest,
  type GmailSaveDraftResult,
  type PiExtensionRequest,
  type PiExtensionResult,
} from "./contracts";
import { piExtensionRegistry } from "./registry";

export async function executePiExtension(
  request: GmailReadThreadContextRequest
): Promise<GmailReadThreadContextResult>;
export async function executePiExtension(
  request: GmailSaveDraftRequest
): Promise<GmailSaveDraftResult>;
export async function executePiExtension(
  request: CalendarCreateEventRequest
): Promise<CalendarCreateEventResult>;
export async function executePiExtension(
  request: CalendarUpdateEventRequest
): Promise<CalendarUpdateEventResult>;
export async function executePiExtension(
  request: PiExtensionRequest
): Promise<PiExtensionResult> {
  switch (request.name) {
    case PI_EXTENSION_NAMES.gmailReadThreadContext:
      return piExtensionRegistry[PI_EXTENSION_NAMES.gmailReadThreadContext](
        request
      );
    case PI_EXTENSION_NAMES.gmailSaveDraft:
      return piExtensionRegistry[PI_EXTENSION_NAMES.gmailSaveDraft](request);
    case PI_EXTENSION_NAMES.calendarCreateEvent:
      return piExtensionRegistry[PI_EXTENSION_NAMES.calendarCreateEvent](
        request
      );
    case PI_EXTENSION_NAMES.calendarUpdateEvent:
      return piExtensionRegistry[PI_EXTENSION_NAMES.calendarUpdateEvent](
        request
      );
  }
}
