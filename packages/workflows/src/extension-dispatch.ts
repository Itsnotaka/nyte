import { approveWorkItem } from "@nyte/application/actions/approve";
import { createProposedActionId } from "@nyte/domain/actions";
import {
  executeExtension,
  EXTENSION_AUDIT_SOURCES,
  EXTENSION_AUTH_PROVIDERS,
  EXTENSION_AUTH_SCOPES,
  EXTENSION_NAMES,
  type CalendarCreateEventRequest,
  type ExtensionExecutionContext,
  type ExtensionResult,
  type GmailSaveDraftRequest,
} from "@nyte/extension-runtime";

type ApprovedWorkItem = Awaited<ReturnType<typeof approveWorkItem>>;

type ExtensionDispatchInput = {
  approvedItem: ApprovedWorkItem;
  userId?: string | null;
};

export async function dispatchApprovedActionToExtension({
  approvedItem,
  userId = null,
}: ExtensionDispatchInput): Promise<ExtensionResult | null> {
  const extensionContext: ExtensionExecutionContext = {
    auth: {
      provider: EXTENSION_AUTH_PROVIDERS.google,
      userId,
      scopes: [...EXTENSION_AUTH_SCOPES.googleWorkspace],
    },
    idempotencyKey: approvedItem.execution.idempotencyKey,
    audit: {
      workItemId: approvedItem.itemId,
      actionId: createProposedActionId(approvedItem.itemId),
      source: EXTENSION_AUDIT_SOURCES.decisionQueue,
    },
  };

  if (approvedItem.payload.kind === "gmail.createDraft") {
    const request: GmailSaveDraftRequest = {
      ...extensionContext,
      name: EXTENSION_NAMES.gmailSaveDraft,
      input: approvedItem.payload,
    };

    return executeExtension(request);
  }

  if (approvedItem.payload.kind === "google-calendar.createEvent") {
    const request: CalendarCreateEventRequest = {
      ...extensionContext,
      name: EXTENSION_NAMES.calendarCreateEvent,
      input: approvedItem.payload,
    };

    return executeExtension(request);
  }

  return null;
}
