import { isToolCallPayload } from "@nyte/domain/actions";
import type { approveActionTask } from "./tasks/approve-action-task";
import type { dismissActionTask } from "./tasks/dismiss-action-task";
import type { feedbackTask } from "./tasks/feedback-task";
import type { ingestSignalsTask } from "./tasks/ingest-signals-task";

type TaskInput<TTask extends (...args: never[]) => unknown> = Parameters<TTask>[0];
type TaskOutput<TTask extends (...args: never[]) => unknown> = Awaited<ReturnType<TTask>>;

export type QueueSyncRequest = Omit<TaskInput<typeof ingestSignalsTask>, "accessToken" | "now">;
export type QueueSyncResponse = Pick<TaskOutput<typeof ingestSignalsTask>, "cursor" | "needsYou">;

export type ApproveActionRequest = Omit<TaskInput<typeof approveActionTask>, "now" | "actorUserId">;
export type ApproveActionResponse = TaskOutput<typeof approveActionTask>;

export type DismissActionRequest = Omit<TaskInput<typeof dismissActionTask>, "now">;
export type DismissActionResponse = TaskOutput<typeof dismissActionTask>;

export type FeedbackActionRequest = Omit<TaskInput<typeof feedbackTask>, "now">;
export type FeedbackActionResponse = TaskOutput<typeof feedbackTask>;

export type WorkflowApiErrorResponse = {
  error: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExecutionResult(value: unknown): boolean {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  const destination = payload.destination;
  const isValidDestination =
    destination === "gmail_drafts" ||
    destination === "google_calendar" ||
    destination === "refund_queue";

  return (
    payload.status === "executed" &&
    isValidDestination &&
    isNonEmptyString(payload.providerReference) &&
    isNonEmptyString(payload.idempotencyKey) &&
    isNonEmptyString(payload.executedAt)
  );
}

function isPiExtensionResultOrNull(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  const name = payload.name;
  const isValidName =
    name === "gmail.readThreadContext" ||
    name === "gmail.saveDraft" ||
    name === "calendar.createEvent" ||
    name === "calendar.updateEvent";

  return (
    isValidName &&
    payload.status === "executed" &&
    isNonEmptyString(payload.idempotencyKey) &&
    isNonEmptyString(payload.executedAt) &&
    asRecord(payload.output) !== null
  );
}

export function isWorkflowApiErrorResponse(value: unknown): value is WorkflowApiErrorResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  const error = payload.error;
  return typeof error === "string" && error.trim().length > 0;
}

export function isQueueSyncResponse(value: unknown): value is QueueSyncResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    Array.isArray(payload.needsYou) &&
    typeof payload.cursor === "string" &&
    payload.cursor.trim().length > 0
  );
}

export function isApproveActionResponse(value: unknown): value is ApproveActionResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    isNonEmptyString(payload.itemId) &&
    isToolCallPayload(payload.payload) &&
    isExecutionResult(payload.execution) &&
    typeof payload.idempotent === "boolean" &&
    isPiExtensionResultOrNull(payload.piExtension)
  );
}

export function isDismissActionResponse(value: unknown): value is DismissActionResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    isNonEmptyString(payload.itemId) &&
    payload.status === "dismissed" &&
    isNonEmptyString(payload.dismissedAt) &&
    typeof payload.idempotent === "boolean"
  );
}

export function isFeedbackActionResponse(value: unknown): value is FeedbackActionResponse {
  const payload = asRecord(value);
  if (!payload) {
    return false;
  }

  return (
    isNonEmptyString(payload.itemId) &&
    (payload.rating === "positive" || payload.rating === "negative") &&
    isNonEmptyString(payload.notedAt)
  );
}
