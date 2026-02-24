import {
  EXTENSION_NAMES,
  type ExtensionRequest,
  type ExtensionResult,
} from "./contracts";
import { extensionRegistry } from "./registry";

export async function executeExtension(
  request: ExtensionRequest
): Promise<ExtensionResult> {
  switch (request.name) {
    case EXTENSION_NAMES.gmailReadThreadContext:
      return extensionRegistry[EXTENSION_NAMES.gmailReadThreadContext](request);
    case EXTENSION_NAMES.gmailSend:
      return extensionRegistry[EXTENSION_NAMES.gmailSend](request);
    case EXTENSION_NAMES.calendarCreateEvent:
      return extensionRegistry[EXTENSION_NAMES.calendarCreateEvent](request);
    case EXTENSION_NAMES.calendarUpdateEvent:
      return extensionRegistry[EXTENSION_NAMES.calendarUpdateEvent](request);
  }
}
