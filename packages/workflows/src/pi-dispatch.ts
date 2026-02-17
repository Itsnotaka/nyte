import { approveWorkItem } from "@nyte/application/actions";
import { executePiExtension, type PiExtensionResult } from "@nyte/pi-runtime";

type ApprovedWorkItem = Awaited<ReturnType<typeof approveWorkItem>>;

const GOOGLE_EXTENSION_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

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
      provider: "google" as const,
      userId,
      scopes: [...GOOGLE_EXTENSION_SCOPES],
    },
    idempotencyKey: approvedItem.execution.idempotencyKey,
    audit: {
      workItemId: approvedItem.itemId,
      actionId: `${approvedItem.itemId}:action`,
      source: "decision-queue" as const,
    },
  };

  if (approvedItem.payload.kind === "gmail.createDraft") {
    return executePiExtension({
      ...extensionContext,
      name: "gmail.saveDraft",
      input: approvedItem.payload,
    });
  }

  if (approvedItem.payload.kind === "google-calendar.createEvent") {
    return executePiExtension({
      ...extensionContext,
      name: "calendar.createEvent",
      input: approvedItem.payload,
    });
  }

  return null;
}
