import { approveWorkItem } from "@nyte/application/actions";
import {
  executePiExtension,
  PI_AUDIT_SOURCES,
  PI_AUTH_PROVIDERS,
  PI_AUTH_SCOPES,
  PI_EXTENSION_NAMES,
  type PiExtensionResult,
} from "@nyte/pi-runtime";

type ApprovedWorkItem = Awaited<ReturnType<typeof approveWorkItem>>;

type PiDispatchInput = {
  approvedItem: ApprovedWorkItem;
  userId?: string | null;
};

export async function dispatchApprovedActionToPi({
  approvedItem,
  userId = null,
}: PiDispatchInput): Promise<PiExtensionResult | null> {
  const extensionContext = {
    auth: {
      provider: PI_AUTH_PROVIDERS.google,
      userId,
      scopes: [...PI_AUTH_SCOPES.googleWorkspace],
    },
    idempotencyKey: approvedItem.execution.idempotencyKey,
    audit: {
      workItemId: approvedItem.itemId,
      actionId: `${approvedItem.itemId}:action`,
      source: PI_AUDIT_SOURCES.decisionQueue,
    },
  };

  if (approvedItem.payload.kind === "gmail.createDraft") {
    return executePiExtension({
      ...extensionContext,
      name: PI_EXTENSION_NAMES.gmailSaveDraft,
      input: approvedItem.payload,
    });
  }

  if (approvedItem.payload.kind === "google-calendar.createEvent") {
    return executePiExtension({
      ...extensionContext,
      name: PI_EXTENSION_NAMES.calendarCreateEvent,
      input: approvedItem.payload,
    });
  }

  return null;
}
